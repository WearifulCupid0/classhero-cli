import {
    createServiceToken,
    type ServiceToken,
} from "@classhero-cli/plugin-api";

/**
 * Small service exported by the example plugin.
 *
 * It exists purely to demonstrate dependency inversion through the
 * ClassHero CLI service registry.
 */
export interface ExamplePluginService {
    /** Returns how many times the diagnostic menu has been opened. */
    getExecutionCount(): Promise<number>;
}

/**
 * Service token published while the example plugin is enabled.
 *
 * Other plugins can import this token and consume the service without
 * depending on the concrete plugin implementation.
 */
export const EXAMPLE_PLUGIN_SERVICE: ServiceToken<ExamplePluginService> =
    createServiceToken<ExamplePluginService>(
        "classhero.example-plugin.diagnostics",
        "Diagnostic service published by the ClassHero CLI example plugin.",
    );
