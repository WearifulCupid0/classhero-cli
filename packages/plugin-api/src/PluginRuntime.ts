import type { ClassHero } from "@classhero-cli/api-wrapper";
import { EventBus } from "./events/EventBus.js";
import { HookRegistry } from "./hooks/HookRegistry.js";
import type { CoreHookMap } from "./hooks/types.js";
import type { PluginLoggerFactory } from "./logging/Logger.js";
import { PluginManager } from "./plugin/PluginManager.js";
import type { CoreEventMap } from "./plugin/PluginContext.js";
import { MenuRegistry } from "./prompts/MenuRegistry.js";
import { PromptHost } from "./prompts/PromptHost.js";
import type { PromptRenderer } from "./prompts/PromptRenderer.js";
import { ServiceRegistry } from "./services/ServiceRegistry.js";
import type { PluginStorageFactory } from "./storage/PluginStorage.js";

/** Options accepted by {@link createPluginRuntime}. */
export interface CreatePluginRuntimeOptions {
    /** Shared authenticated ClassHero SDK instance. */
    readonly api: ClassHero;
    /** Host renderer, implemented by `apps/cli` using `@clack/prompts`. */
    readonly renderer: PromptRenderer;
    /** Optional plugin-scoped logger factory. */
    readonly loggerFactory?: PluginLoggerFactory;
    /** Optional persistent plugin storage factory. */
    readonly storageFactory?: PluginStorageFactory;
}

/**
 * Fully wired plugin runtime used by the CLI.
 *
 * Advanced hosts may instantiate the individual registries themselves, but
 * most applications should use this shape to keep prompt hooks, menus,
 * services, events and lifecycle management attached to the same runtime.
 */
export interface PluginRuntime {
    readonly hooks: HookRegistry<CoreHookMap>;
    readonly menus: MenuRegistry;
    readonly services: ServiceRegistry;
    readonly events: EventBus<CoreEventMap>;
    readonly prompts: PromptHost;
    readonly plugins: PluginManager;
}

/** Creates a complete plugin runtime without importing any UI framework. */
export function createPluginRuntime(options: CreatePluginRuntimeOptions): PluginRuntime {
    const hooks = new HookRegistry<CoreHookMap>();
    const menus = new MenuRegistry();
    const services = new ServiceRegistry();
    const events = new EventBus<CoreEventMap>();
    const prompts = new PromptHost(options.renderer, hooks, menus);
    const plugins = new PluginManager({
        api: options.api,
        hooks,
        menus,
        prompts,
        services,
        events,
        ...(options.loggerFactory === undefined ? {} : { loggerFactory: options.loggerFactory }),
        ...(options.storageFactory === undefined ? {} : { storageFactory: options.storageFactory }),
    });

    return { hooks, menus, services, events, prompts, plugins };
}
