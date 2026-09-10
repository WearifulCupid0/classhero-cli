/**
 * Persisted OpenAI provider configuration.
 *
 * No prompt text is configurable. Prompts belong to the automator's typed
 * activity executors and remain hardcoded in source code.
 */
export interface OpenAIProviderConfig {
    /** Secret OpenAI API key used only by the local provider process. */
    readonly apiKey: string;
    /** Exact OpenAI model id selected by the user. */
    readonly model: string;
    /** ISO timestamp of the most recent successful validation. */
    readonly validatedAt: string;
}

/** Non-secret configuration/status safe to display in logs and menus. */
export interface OpenAIProviderPublicConfig {
    readonly configured: boolean;
    readonly model?: string;
    readonly maskedApiKey?: string;
    readonly validatedAt?: string;
}
