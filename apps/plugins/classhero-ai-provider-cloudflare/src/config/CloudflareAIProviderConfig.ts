/**
 * Persisted Cloudflare AI Gateway provider configuration.
 *
 * Everything required to use the gateway is configured through the plugin
 * menu; no Cloudflare-specific environment variables are required.
 */
export interface CloudflareAIProviderConfig {
    /** Cloudflare account that owns the AI Gateway. */
    readonly accountId: string;

    /**
     * AI Gateway id/name.
     *
     * `default` is a convenient conventional value, but the gateway still
     * needs to exist for provider-specific SDK routing.
     */
    readonly gatewayId: string;

    /**
     * Optional Cloudflare API token used when the AI Gateway has
     * authentication enabled.
     *
     * When provided, the configuration validator also uses it to verify the
     * account/gateway through Cloudflare's management API without inference.
     */
    readonly gatewayToken?: string;

    /**
     * Upstream provider API key.
     *
     * Examples: OpenAI for `openai/...`, Anthropic for `anthropic/...`,
     * Google AI Studio for `google/...`.
     */
    readonly apiKey: string;

    /** Cloudflare Unified model reference in `provider/model` form. */
    readonly model: string;

    /** ISO timestamp of the most recent successful configuration validation. */
    readonly validatedAt: string;
}

/** Non-secret status suitable for CLI menus and logs. */
export interface CloudflareAIProviderPublicConfig {
    readonly configured: boolean;
    readonly accountId?: string;
    readonly gatewayId?: string;
    readonly gatewayAuthenticationConfigured: boolean;
    readonly model?: string;
    readonly maskedApiKey?: string;
    readonly maskedGatewayToken?: string;
    readonly validatedAt?: string;
}
