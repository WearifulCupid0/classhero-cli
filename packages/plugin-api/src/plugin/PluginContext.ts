import type { ClassHero } from "@classhero-cli/api-wrapper";
import type { EventBus } from "../events/EventBus.js";
import type { HookRegistrationOptions, HookRegistry } from "../hooks/HookRegistry.js";
import type { CoreHookMap, HookPayload, HookResult } from "../hooks/types.js";
import type { HookMiddleware } from "../hooks/Middleware.js";
import type { Disposable, DisposableStack } from "../lifecycle/Disposable.js";
import type { PluginLogger } from "../logging/Logger.js";
import type { MenuContribution, MenuContributionOptions, MenuRegistry } from "../prompts/MenuRegistry.js";
import type { PromptHost } from "../prompts/PromptHost.js";
import type { ServiceRegistry, ServiceToken } from "../services/ServiceRegistry.js";
import type { PluginStorage } from "../storage/PluginStorage.js";
import type { PluginManifest } from "./PluginManifest.js";

/** Built-in event payloads shared between the CLI and plugins. */
export interface CoreEventMap {
    "plugin:registered": { readonly pluginId: string };
    "plugin:enabled": { readonly pluginId: string };
    "plugin:disabled": { readonly pluginId: string };
    "plugin:disposed": { readonly pluginId: string };
}

/** Hook registration facade automatically scoped to the current plugin. */
export interface PluginHookRegistrar {
    use<K extends keyof CoreHookMap>(
        hook: K,
        middleware: HookMiddleware<HookPayload<CoreHookMap, K>, HookResult<CoreHookMap, K>>,
        options?: Omit<HookRegistrationOptions, "owner">,
    ): Disposable;
}

/** Menu contribution facade automatically scoped to the current plugin. */
export interface PluginMenuRegistrar {
    contribute<T>(
        promptId: string,
        contribution: MenuContribution<T>,
        options?: Omit<MenuContributionOptions, "owner">,
    ): Disposable;
}

/** Service facade that automatically attributes providers to the current plugin. */
export interface PluginServices {
    provide<T>(token: ServiceToken<T>, value: T, options?: { readonly priority?: number }): Disposable;
    get<T>(token: ServiceToken<T>): T | undefined;
    getAll<T>(token: ServiceToken<T>): readonly T[];
    has<T>(token: ServiceToken<T>): boolean;
}

/** Event facade scoped to the current plugin. */
export interface PluginEvents {
    on<K extends keyof CoreEventMap>(
        event: K,
        listener: (payload: CoreEventMap[K]) => void | Promise<void>,
        options?: { readonly priority?: number },
    ): Disposable;
}

/**
 * Capabilities supplied to every plugin lifecycle callback.
 *
 * Registrations performed through `hooks`, `menus`, `services` and `events`
 * are automatically tracked by the lifecycle scope in which this context was
 * created. Plugin authors therefore do not need to keep cleanup handles unless
 * they want to dispose a resource earlier than normal.
 */
export interface PluginContext {
    /** Metadata of the plugin receiving this context. */
    readonly plugin: PluginManifest;
    /** Shared authenticated ClassHero SDK instance used by the host CLI. */
    readonly api: ClassHero;
    /** Typed hook/middleware registration surface. */
    readonly hooks: PluginHookRegistrar;
    /** Menu extension surface for stable prompt ids. */
    readonly menus: PluginMenuRegistrar;
    /** Prompt host used to execute new plugin-owned flows. */
    readonly prompts: PromptHost;
    /** Cross-plugin dependency-inversion registry. */
    readonly services: PluginServices;
    /** Lightweight asynchronous event surface. */
    readonly events: PluginEvents;
    /** Plugin-scoped logger. */
    readonly logger: PluginLogger;
    /** Plugin-scoped persistent/configuration storage supplied by the host. */
    readonly storage: PluginStorage;
    /** Explicitly tracks an arbitrary disposable in the current lifecycle scope. */
    track<T extends Disposable>(resource: T): T;
}

/** Internal dependencies required to construct a scoped context. */
export interface PluginContextDependencies {
    readonly api: ClassHero;
    readonly hooks: HookRegistry<CoreHookMap>;
    readonly menus: MenuRegistry;
    readonly prompts: PromptHost;
    readonly services: ServiceRegistry;
    readonly events: EventBus<CoreEventMap>;
    readonly logger: PluginLogger;
    readonly storage: PluginStorage;
}

/** @internal Creates a plugin context bound to one lifecycle resource stack. */
export function createPluginContext(
    plugin: PluginManifest,
    dependencies: PluginContextDependencies,
    scope: DisposableStack,
): PluginContext {
    const track = <T extends Disposable>(resource: T): T => scope.add(resource);

    return {
        plugin,
        api: dependencies.api,
        prompts: dependencies.prompts,
        logger: dependencies.logger,
        storage: dependencies.storage,
        track,
        hooks: {
            use: (hook, middleware, options = {}) => track(dependencies.hooks.use(hook, middleware, {
                ...options,
                owner: plugin.id,
            })),
        },
        menus: {
            contribute: (promptId, contribution, options = {}) => track(dependencies.menus.contribute(promptId, contribution, {
                ...options,
                owner: plugin.id,
            })),
        },
        services: {
            provide: (token, value, options = {}) => track(dependencies.services.provide(token, value, {
                owner: plugin.id,
                ...(options.priority === undefined ? {} : { priority: options.priority }),
            })),
            get: (token) => dependencies.services.get(token),
            getAll: (token) => dependencies.services.getAll(token),
            has: (token) => dependencies.services.has(token),
        },
        events: {
            on: (event, listener, options = {}) => track(dependencies.events.on(event, listener, {
                owner: plugin.id,
                ...(options.priority === undefined ? {} : { priority: options.priority }),
            })),
        },
    };
}
