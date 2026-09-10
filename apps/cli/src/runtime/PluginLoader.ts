import path from "node:path";
import { pathToFileURL } from "node:url";
import type { ClassHeroPlugin, PluginManager, PluginState } from "@classhero-cli/plugin-api";
import { PluginConfigStore, type PluginConfigEntry } from "./PluginConfigStore.js";

/** Runtime association between a configured module and its plugin id. */
export interface LoadedPlugin {
    readonly specifier: string;
    readonly pluginId: string;
}

/** One plugin load error collected during startup. */
export interface PluginLoadFailure {
    readonly specifier: string;
    readonly error: unknown;
}

/** Startup result for configured plugins. */
export interface PluginLoadReport {
    readonly loaded: readonly LoadedPlugin[];
    readonly failures: readonly PluginLoadFailure[];
}

/** Config entry enriched with the runtime plugin state when loaded. */
export interface ConfiguredPluginState extends PluginConfigEntry {
    readonly pluginId?: string;
    readonly runtime?: PluginState;
}

/** Dynamically imports modules and bridges them into {@link PluginManager}. */
export class PluginLoader {
    private readonly loaded = new Map<string, LoadedPlugin>();

    constructor(
        private readonly manager: PluginManager,
        private readonly config: PluginConfigStore,
        private readonly baseDirectory = process.cwd(),
    ) {}

    async loadConfigured(): Promise<PluginLoadReport> {
        const config = await this.config.load();
        const loaded: LoadedPlugin[] = [];
        const failures: PluginLoadFailure[] = [];
        const failedSpecifiers = new Set<string>();

        // Register every module before enabling any of them. This makes startup
        // independent of configuration order when plugins depend on each other.
        for (const entry of config.plugins) {
            try {
                loaded.push(await this.load(entry.specifier, false));
            } catch (error) {
                failedSpecifiers.add(entry.specifier);
                failures.push({ specifier: entry.specifier, error });
            }
        }

        for (const entry of config.plugins) {
            if (!entry.enabled || failedSpecifiers.has(entry.specifier)) {
                continue;
            }

            const registered = this.loaded.get(entry.specifier);
            if (!registered) {
                continue;
            }

            try {
                await this.manager.enable(registered.pluginId);
            } catch (error) {
                failures.push({ specifier: entry.specifier, error });
            }
        }

        return { loaded, failures };
    }

    async add(specifier: string, enabled = true): Promise<LoadedPlugin> {
        const normalized = specifier.trim();
        if (!normalized) {
            throw new Error("O identificador do plugin não pode ser vazio.");
        }

        const loaded = await this.load(normalized, enabled);
        await this.config.upsert({ specifier: normalized, enabled });
        return loaded;
    }

    async load(specifier: string, enabled = true): Promise<LoadedPlugin> {
        const existing = this.loaded.get(specifier);
        if (existing) {
            if (enabled) {
                await this.manager.enable(existing.pluginId);
            }
            return existing;
        }

        const imported = await import(this.resolveSpecifier(specifier));
        const plugin = await extractPlugin(imported);

        await this.manager.register(plugin);
        const loaded: LoadedPlugin = {
            specifier,
            pluginId: plugin.manifest.id,
        };
        this.loaded.set(specifier, loaded);

        try {
            if (enabled) {
                await this.manager.enable(plugin.manifest.id);
            }
            return loaded;
        } catch (error) {
            this.loaded.delete(specifier);
            await this.manager.dispose(plugin.manifest.id).catch(() => undefined);
            throw error;
        }
    }

    async setEnabled(specifier: string, enabled: boolean): Promise<void> {
        let loaded = this.loaded.get(specifier);
        if (!loaded && enabled) {
            loaded = await this.load(specifier, true);
        } else if (loaded) {
            if (enabled) {
                await this.manager.enable(loaded.pluginId);
            } else {
                await this.manager.disable(loaded.pluginId);
            }
        }

        await this.config.setEnabled(specifier, enabled);
    }

    async remove(specifier: string): Promise<void> {
        const loaded = this.loaded.get(specifier);
        if (loaded) {
            await this.manager.dispose(loaded.pluginId);
            this.loaded.delete(specifier);
        }
        await this.config.remove(specifier);
    }

    async list(): Promise<readonly ConfiguredPluginState[]> {
        const config = await this.config.load();
        return config.plugins.map((entry) => {
            const loaded = this.loaded.get(entry.specifier);
            if (!loaded) {
                return { ...entry };
            }

            const runtime = this.manager.get(loaded.pluginId);
            return {
                ...entry,
                pluginId: loaded.pluginId,
                ...(runtime === undefined ? {} : { runtime }),
            };
        });
    }

    private resolveSpecifier(specifier: string): string {
        if (specifier.startsWith("file:")) {
            return specifier;
        }

        if (specifier.startsWith(".") || path.isAbsolute(specifier)) {
            return pathToFileURL(path.resolve(this.baseDirectory, specifier)).href;
        }

        return specifier;
    }
}

type PluginModule = Record<string, unknown>;

async function extractPlugin(module: PluginModule): Promise<ClassHeroPlugin> {
    const factory = module.createPlugin;
    if (typeof factory === "function") {
        const candidate = await factory();
        if (isPlugin(candidate)) {
            return candidate;
        }
    }

    const direct = module.default ?? module.plugin;
    if (typeof direct === "function") {
        const candidate = await direct();
        if (isPlugin(candidate)) {
            return candidate;
        }
    }

    if (isPlugin(direct)) {
        return direct;
    }

    throw new Error(
        "Módulo de plugin inválido. Exporte `default`, `plugin` ou `createPlugin()` com um ClassHeroPlugin.",
    );
}

function isPlugin(value: unknown): value is ClassHeroPlugin {
    if (!value || typeof value !== "object" || !("manifest" in value)) {
        return false;
    }

    const manifest = (value as { manifest?: unknown }).manifest;
    return Boolean(
        manifest
        && typeof manifest === "object"
        && "id" in manifest
        && typeof (manifest as { id?: unknown }).id === "string"
        && "name" in manifest
        && typeof (manifest as { name?: unknown }).name === "string"
        && "version" in manifest
        && typeof (manifest as { version?: unknown }).version === "string"
        && "apiVersion" in manifest
        && typeof (manifest as { apiVersion?: unknown }).apiVersion === "string",
    );
}
