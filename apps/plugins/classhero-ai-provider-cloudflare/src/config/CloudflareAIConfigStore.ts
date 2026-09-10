import type {
    PluginStorage,
} from "@classhero-cli/plugin-api";
import type {
    CloudflareAIProviderConfig,
} from "./CloudflareAIProviderConfig.js";

const STORAGE_KEY = "cloudflare-ai";

/**
 * Plugin-scoped storage for Cloudflare routing and upstream provider settings.
 */
export class CloudflareAIConfigStore {
    constructor(
        private readonly storage: PluginStorage,
    ) {}

    /** Returns persisted configuration only when structurally complete. */
    async get(): Promise<CloudflareAIProviderConfig | undefined> {
        const value =
            await this.storage.get<unknown>(
                STORAGE_KEY,
            );

        if (!isRecord(value)) {
            return undefined;
        }

        if (
            !nonEmpty(value.accountId) ||
            !nonEmpty(value.gatewayId) ||
            !nonEmpty(value.apiKey) ||
            !nonEmpty(value.model) ||
            !nonEmpty(value.validatedAt)
        ) {
            return undefined;
        }

        return {
            accountId:
                value.accountId,
            gatewayId:
                value.gatewayId,
            ...(nonEmpty(value.gatewayToken)
                ? {
                    gatewayToken:
                        value.gatewayToken,
                }
                : {}),
            apiKey:
                value.apiKey,
            model:
                value.model,
            validatedAt:
                value.validatedAt,
        };
    }

    /** Persists only configuration that already passed the validator. */
    async set(
        config: CloudflareAIProviderConfig,
    ): Promise<void> {
        await this.storage.set(
            STORAGE_KEY,
            {
                accountId:
                    config.accountId,
                gatewayId:
                    config.gatewayId,
                ...(config.gatewayToken ===
                undefined
                    ? {}
                    : {
                        gatewayToken:
                            config.gatewayToken,
                    }),
                apiKey:
                    config.apiKey,
                model:
                    config.model,
                validatedAt:
                    config.validatedAt,
            },
        );
    }

    /** Removes every Cloudflare/provider credential owned by this plugin. */
    async clear(): Promise<boolean> {
        return this.storage.delete(
            STORAGE_KEY,
        );
    }
}

function nonEmpty(
    value: unknown,
): value is string {
    return (
        typeof value ===
            "string" &&
        value.trim().length >
            0
    );
}

function isRecord(
    value: unknown,
): value is Record<string, unknown> {
    return (
        typeof value ===
            "object" &&
        value !== null &&
        !Array.isArray(value)
    );
}
