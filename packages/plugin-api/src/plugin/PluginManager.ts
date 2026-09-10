import type { ClassHero } from "@classhero-cli/api-wrapper";
import type { EventBus } from "../events/EventBus.js";
import type { HookRegistry } from "../hooks/HookRegistry.js";
import type { CoreHookMap } from "../hooks/types.js";
import { DisposableStack } from "../lifecycle/Disposable.js";
import type { PluginLogger, PluginLoggerFactory } from "../logging/Logger.js";
import { ConsolePluginLogger } from "../logging/Logger.js";
import type { MenuRegistry } from "../prompts/MenuRegistry.js";
import type { PromptHost } from "../prompts/PromptHost.js";
import type { ServiceRegistry } from "../services/ServiceRegistry.js";
import type { PluginStorage, PluginStorageFactory } from "../storage/PluginStorage.js";
import { MemoryPluginStorage } from "../storage/PluginStorage.js";
import type { ClassHeroPlugin } from "./Plugin.js";
import type { CoreEventMap, PluginContextDependencies } from "./PluginContext.js";
import { createPluginContext } from "./PluginContext.js";
import { PLUGIN_API_VERSION, type PluginDependency } from "./PluginManifest.js";

/** Current lifecycle state of a registered plugin. */
export type PluginStatus = "registered" | "enabled" | "disabled";

/** Public runtime information returned by {@link PluginManager.list}. */
export interface PluginState {
    readonly id: string;
    readonly name: string;
    readonly version: string;
    readonly status: PluginStatus;
    readonly lastError?: unknown;
}

/** Dependencies required by {@link PluginManager}. */
export interface PluginManagerOptions {
    readonly api: ClassHero;
    readonly hooks: HookRegistry<CoreHookMap>;
    readonly menus: MenuRegistry;
    readonly prompts: PromptHost;
    readonly services: ServiceRegistry;
    readonly events: EventBus<CoreEventMap>;
    readonly apiVersion?: string;
    readonly loggerFactory?: PluginLoggerFactory;
    readonly storageFactory?: PluginStorageFactory;
}

interface PluginRecord {
    readonly plugin: ClassHeroPlugin;
    readonly registrationScope: DisposableStack;
    readonly logger: PluginLogger;
    readonly storage: PluginStorage;
    enableScope: DisposableStack | undefined;
    status: PluginStatus;
    lastError: unknown | undefined;
}

/**
 * Loads plugins, validates dependencies and owns their lifecycle resources.
 *
 * Required dependencies are enabled recursively before the dependent plugin.
 * Disabling a plugin also disables currently enabled dependents first, avoiding
 * a runtime where a consumer remains active after its provider disappears.
 */
export class PluginManager {
    private readonly records = new Map<string, PluginRecord>();
    private readonly apiVersion: string;

    constructor(private readonly options: PluginManagerOptions) {
        this.apiVersion = options.apiVersion ?? PLUGIN_API_VERSION;
    }

    /** Registers a plugin exactly once without enabling it. */
    async register(plugin: ClassHeroPlugin): Promise<void> {
        const { manifest } = plugin;
        this.validateManifest(plugin);

        if (this.records.has(manifest.id)) {
            throw new Error(`Plugin ${manifest.id} is already registered.`);
        }

        const registrationScope = new DisposableStack();
        const record: PluginRecord = {
            plugin,
            registrationScope,
            logger: this.options.loggerFactory?.(manifest.id) ?? new ConsolePluginLogger(manifest.id),
            storage: this.options.storageFactory?.(manifest.id) ?? new MemoryPluginStorage(),
            enableScope: undefined,
            status: "registered",
            lastError: undefined,
        };

        this.records.set(manifest.id, record);

        try {
            const context = createPluginContext(manifest, this.contextDependencies(record), registrationScope);
            const disposable = await plugin.register?.(context);
            if (disposable) {
                registrationScope.add(disposable);
            }
            await this.options.events.emit("plugin:registered", { pluginId: manifest.id });
        } catch (error) {
            record.lastError = error;
            this.records.delete(manifest.id);
            await registrationScope.dispose().catch(() => undefined);
            throw error;
        }
    }

    /** Enables a plugin and all of its required dependencies. */
    async enable(pluginId: string): Promise<void> {
        await this.enableInternal(pluginId, new Set());
    }

    /**
     * Disables a plugin.
     *
     * Enabled dependents are disabled before the target so required services
     * never disappear from underneath an active consumer.
     */
    async disable(pluginId: string): Promise<void> {
        const record = this.requireRecord(pluginId);
        if (record.status !== "enabled") {
            if (record.status === "registered") {
                record.status = "disabled";
            }
            return;
        }

        for (const dependent of this.enabledDependentsOf(pluginId)) {
            await this.disable(dependent.plugin.manifest.id);
        }

        const transient = new DisposableStack();
        try {
            const context = createPluginContext(record.plugin.manifest, this.contextDependencies(record), transient);
            await record.plugin.disable?.(context);
        } finally {
            await transient.dispose();
            await record.enableScope?.dispose();
            record.enableScope = undefined;
            record.status = "disabled";
            await this.options.events.emit("plugin:disabled", { pluginId });
        }
    }

    /** Disposes and unregisters a plugin after disposing all dependents. */
    async dispose(pluginId: string): Promise<void> {
        await this.disposeInternal(pluginId, new Set());
    }

    /** Disposes every plugin in dependency-safe order. */
    async disposeAll(): Promise<void> {
        while (this.records.size > 0) {
            const pluginId = this.records.keys().next().value as string | undefined;
            if (!pluginId) {
                return;
            }
            await this.dispose(pluginId);
        }
    }

    /** Returns immutable state for all currently registered plugins. */
    list(): readonly PluginState[] {
        return [...this.records.values()].map((record) => ({
            id: record.plugin.manifest.id,
            name: record.plugin.manifest.name,
            version: record.plugin.manifest.version,
            status: record.status,
            ...(record.lastError === undefined ? {} : { lastError: record.lastError }),
        }));
    }

    /** Returns one plugin state, or `undefined` when not registered. */
    get(pluginId: string): PluginState | undefined {
        const record = this.records.get(pluginId);
        if (!record) {
            return undefined;
        }

        return {
            id: record.plugin.manifest.id,
            name: record.plugin.manifest.name,
            version: record.plugin.manifest.version,
            status: record.status,
            ...(record.lastError === undefined ? {} : { lastError: record.lastError }),
        };
    }


    private async disposeInternal(pluginId: string, visiting: Set<string>): Promise<void> {
        if (visiting.has(pluginId)) {
            return;
        }

        const record = this.requireRecord(pluginId);
        visiting.add(pluginId);

        try {
            for (const dependent of this.dependentsOf(pluginId)) {
                await this.disposeInternal(dependent.plugin.manifest.id, visiting);
            }

            if (record.status === "enabled") {
                await this.disable(pluginId);
            }

            const transient = new DisposableStack();
            try {
                const context = createPluginContext(record.plugin.manifest, this.contextDependencies(record), transient);
                await record.plugin.dispose?.(context);
            } finally {
                await transient.dispose();
                await record.registrationScope.dispose();
                this.records.delete(pluginId);
                await this.options.events.emit("plugin:disposed", { pluginId });
            }
        } finally {
            visiting.delete(pluginId);
        }
    }

    private async enableInternal(pluginId: string, visiting: Set<string>): Promise<void> {
        const record = this.requireRecord(pluginId);
        if (record.status === "enabled") {
            return;
        }

        if (visiting.has(pluginId)) {
            throw new Error(`Circular plugin dependency detected at ${pluginId}.`);
        }

        visiting.add(pluginId);
        try {
            for (const dependency of record.plugin.manifest.dependencies ?? []) {
                this.assertDependency(record.plugin.manifest.id, dependency);
                await this.enableInternal(dependency.id, visiting);
            }

            const enableScope = new DisposableStack();
            try {
                const context = createPluginContext(record.plugin.manifest, this.contextDependencies(record), enableScope);
                const disposable = await record.plugin.enable?.(context);
                if (disposable) {
                    enableScope.add(disposable);
                }
                record.enableScope = enableScope;
                record.status = "enabled";
                record.lastError = undefined;
                await this.options.events.emit("plugin:enabled", { pluginId });
            } catch (error) {
                record.lastError = error;
                await enableScope.dispose().catch(() => undefined);
                throw error;
            }
        } finally {
            visiting.delete(pluginId);
        }
    }

    private contextDependencies(record: PluginRecord): PluginContextDependencies {
        return {
            api: this.options.api,
            hooks: this.options.hooks,
            menus: this.options.menus,
            prompts: this.options.prompts,
            services: this.options.services,
            events: this.options.events,
            logger: record.logger,
            storage: record.storage,
        };
    }

    private validateManifest(plugin: ClassHeroPlugin): void {
        const { manifest } = plugin;
        if (!manifest.id.trim() || !manifest.name.trim() || !manifest.version.trim()) {
            throw new Error("Plugin manifest id, name and version are required.");
        }
        if (manifest.apiVersion !== this.apiVersion) {
            throw new Error(
                `Plugin ${manifest.id} requires plugin API ${manifest.apiVersion}, but the host provides ${this.apiVersion}.`,
            );
        }
    }

    private assertDependency(ownerId: string, dependency: PluginDependency): void {
        const dependencyRecord = this.records.get(dependency.id);
        if (!dependencyRecord) {
            throw new Error(`Plugin ${ownerId} requires missing plugin ${dependency.id}.`);
        }
        if (dependency.version !== undefined && dependencyRecord.plugin.manifest.version !== dependency.version) {
            throw new Error(
                `Plugin ${ownerId} requires ${dependency.id}@${dependency.version}, but ${dependencyRecord.plugin.manifest.version} is registered.`,
            );
        }
    }

    private requireRecord(pluginId: string): PluginRecord {
        const record = this.records.get(pluginId);
        if (!record) {
            throw new Error(`Plugin ${pluginId} is not registered.`);
        }
        return record;
    }

    private dependentsOf(pluginId: string): PluginRecord[] {
        return [...this.records.values()].filter((record) =>
            record.plugin.manifest.dependencies?.some((dependency) => dependency.id === pluginId) ?? false,
        );
    }

    private enabledDependentsOf(pluginId: string): PluginRecord[] {
        return this.dependentsOf(pluginId).filter((record) => record.status === "enabled");
    }
}
