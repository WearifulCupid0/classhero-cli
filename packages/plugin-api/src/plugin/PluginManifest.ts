/** API compatibility version implemented by this package. */
export const PLUGIN_API_VERSION = "1" as const;

/** Dependency on another plugin. */
export interface PluginDependency {
    /** Stable id of the required plugin. */
    readonly id: string;
    /** Optional exact plugin version required by the consumer. */
    readonly version?: string;
}

/**
 * Static metadata declared by every ClassHero CLI plugin.
 *
 * Plugin ids should be globally unique (for example
 * `classhero-ai-automator` or `@vendor/my-plugin`).
 */
export interface PluginManifest {
    /** Stable plugin identifier used in configuration and dependencies. */
    readonly id: string;
    /** Human-readable plugin name. */
    readonly name: string;
    /** Plugin package/application version. */
    readonly version: string;
    /** Plugin API version expected by this plugin. */
    readonly apiVersion: string;
    /** Short description shown by plugin management UIs. */
    readonly description?: string;
    /** Required plugins. They are enabled before this plugin. */
    readonly dependencies?: readonly PluginDependency[];
    /** Optional plugins that may enhance functionality when installed. */
    readonly optionalDependencies?: readonly PluginDependency[];
}
