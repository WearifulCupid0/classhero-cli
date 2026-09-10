import type { Disposable } from "../lifecycle/Disposable.js";
import type { PluginContext } from "./PluginContext.js";
import type { PluginManifest } from "./PluginManifest.js";

/** Lifecycle callback result accepted by the runtime. */
export type PluginLifecycleResult = void | Disposable | Promise<void | Disposable>;

/**
 * Contract implemented by external and built-in ClassHero CLI plugins.
 *
 * Lifecycle semantics:
 * - `register()` runs once when the plugin is loaded. Resources registered here
 *   remain until the plugin is disposed.
 * - `enable()` runs every time the plugin becomes active. Hooks/menu entries
 *   registered here are automatically removed on disable.
 * - `disable()` allows graceful shutdown before enable-scoped resources are
 *   released.
 * - `dispose()` runs once before registration-scoped resources are released.
 */
export interface ClassHeroPlugin {
    /** Immutable plugin metadata. */
    readonly manifest: PluginManifest;

    /** Performs one-time plugin registration. */
    register?(context: PluginContext): PluginLifecycleResult;

    /** Activates behavior exposed by this plugin. */
    enable?(context: PluginContext): PluginLifecycleResult;

    /** Stops active behavior. Do not register long-lived resources here. */
    disable?(context: PluginContext): void | Promise<void>;

    /** Performs final cleanup before the plugin is unloaded. */
    dispose?(context: PluginContext): void | Promise<void>;
}
