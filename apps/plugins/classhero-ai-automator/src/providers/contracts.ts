import type {
    ActivityContext,
    AutomationTargetId,
} from "../contracts/activity.js";

/**
 * Semantic capabilities that an AI provider may advertise.
 *
 * Providers do not decide when a capability should be used. That decision
 * belongs to the automator planner.
 */
export type AIProviderCapability =
    | "quiz"
    | "hangman"
    | "anagram"
    | "interactive-path"
    | "code"
    | "discursive"
    | "structured-output";

/** Basic model metadata exposed by a provider plugin. */
export interface AIProviderModel {
    readonly id: string;
    readonly name?: string;
    readonly capabilities?: readonly AIProviderCapability[];
}

/**
 * Provider-neutral request produced by an AI activity executor.
 *
 * The contract intentionally contains no OpenAI/Gemini-specific fields.
 */
export interface AIProviderRequest {
    readonly task: AutomationTargetId;
    readonly activity: ActivityContext;
    readonly systemInstruction: string;
    readonly input: Readonly<Record<string, unknown>>;
    readonly output?: AIProviderOutputRequirement;
    readonly model?: string;
}

/** Optional structured-output requirement requested by the automator. */
export interface AIProviderOutputRequirement {
    readonly kind: "text" | "json";
    readonly description?: string;
    readonly jsonSchema?: Readonly<Record<string, unknown>>;
}

/** Token usage reported by providers when their SDK exposes it. */
export interface AIProviderUsage {
    readonly inputTokens?: number;
    readonly outputTokens?: number;
    readonly totalTokens?: number;
}

/** Provider-neutral generation result. */
export interface AIProviderResult {
    readonly text: string;
    readonly data?: unknown;
    readonly model?: string;
    readonly usage?: AIProviderUsage;
    readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Dependency-inversion boundary implemented by OpenAI, Gemini or any other
 * model-provider plugin.
 *
 * The automator depends only on this interface and never imports an AI SDK.
 */
export interface AIProvider {
    /** Stable provider id, for example `openai` or `gemini`. */
    readonly id: string;
    /** Human-readable provider name. */
    readonly name: string;
    /** Capabilities supported by this provider. */
    readonly capabilities: readonly AIProviderCapability[];
    /** Models made available by the provider, when discoverable. */
    readonly models?: readonly AIProviderModel[];

    /**
     * Optional health/configuration check.
     *
     * A provider should return `false` when credentials/configuration are
     * missing instead of throwing for a normal unconfigured state.
     */
    isAvailable?(): boolean | Promise<boolean>;

    /** Executes one provider-neutral generation request. */
    generate(request: AIProviderRequest): Promise<AIProviderResult>;
}
