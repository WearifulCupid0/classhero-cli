/** Structured metadata accepted by plugin loggers. */
export type LogMetadata = Readonly<Record<string, unknown>>;

/**
 * Logging surface exposed to plugins.
 *
 * The SDK intentionally defines an interface instead of depending on a
 * logging library. `apps/cli` can later bridge this contract to any logger.
 */
export interface PluginLogger {
    debug(message: string, metadata?: LogMetadata): void;
    info(message: string, metadata?: LogMetadata): void;
    warn(message: string, metadata?: LogMetadata): void;
    error(message: string, metadata?: LogMetadata): void;
}

/** Factory used by the runtime to create a plugin-scoped logger. */
export type PluginLoggerFactory = (pluginId: string) => PluginLogger;

/**
 * Minimal console-backed logger used when the host does not provide one.
 * Every line is prefixed with the plugin id to preserve attribution.
 */
export class ConsolePluginLogger implements PluginLogger {
    constructor(private readonly pluginId: string) {}

    debug(message: string, metadata?: LogMetadata): void {
        console.debug(`[${this.pluginId}] ${message}`, metadata ?? "");
    }

    info(message: string, metadata?: LogMetadata): void {
        console.info(`[${this.pluginId}] ${message}`, metadata ?? "");
    }

    warn(message: string, metadata?: LogMetadata): void {
        console.warn(`[${this.pluginId}] ${message}`, metadata ?? "");
    }

    error(message: string, metadata?: LogMetadata): void {
        console.error(`[${this.pluginId}] ${message}`, metadata ?? "");
    }
}
