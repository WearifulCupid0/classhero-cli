import type { PluginStorage } from "@classhero-cli/plugin-api";
import type {
    OpenAIProviderConfig,
} from "./OpenAIProviderConfig.js";

const STORAGE_KEY = "openai";

/**
 * Plugin-scoped persistence adapter for OpenAI credentials.
 *
 * The host's current plugin storage is local JSON storage. The key is never
 * logged by this package, and `.classhero-cli/` should remain gitignored.
 */
export class OpenAIConfigStore {
    constructor(private readonly storage: PluginStorage) {}

    /** Returns the saved configuration when it is structurally valid. */
    async get(): Promise<OpenAIProviderConfig | undefined> {
        const value = await this.storage.get<unknown>(
            STORAGE_KEY,
        );

        if (!isRecord(value)) {
            return undefined;
        }

        if (
            typeof value.apiKey !== "string" ||
            value.apiKey.trim().length === 0 ||
            typeof value.model !== "string" ||
            value.model.trim().length === 0 ||
            typeof value.validatedAt !== "string"
        ) {
            return undefined;
        }

        return {
            apiKey: value.apiKey,
            model: value.model,
            validatedAt: value.validatedAt,
        };
    }

    /** Persists a configuration that has already passed provider validation. */
    async set(config: OpenAIProviderConfig): Promise<void> {
        await this.storage.set(
            STORAGE_KEY,
            {
                apiKey: config.apiKey,
                model: config.model,
                validatedAt: config.validatedAt,
            },
        );
    }

    /** Removes all persisted OpenAI provider credentials. */
    async clear(): Promise<boolean> {
        return this.storage.delete(STORAGE_KEY);
    }
}

function isRecord(
    value: unknown,
): value is Record<string, unknown> {
    return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
    );
}
