import type {
    ActivityContext,
    AutomationTargetId,
} from "../contracts/activity.js";
import type {
    MissionAutomationContext,
} from "../contracts/mission.js";

/** Tasks that can be delegated to an AI provider. */
export type AIProviderTaskId =
    | AutomationTargetId
    | "mission-reflection"
    | "mission-synthesis";

/** Semantic capabilities that an AI provider may advertise. */
export type AIProviderCapability =
    | "quiz"
    | "hangman"
    | "anagram"
    | "interactive-path"
    | "code"
    | "discursive"
    | "reflection"
    | "synthesis"
    | "structured-output";

/** Basic model metadata exposed by a provider plugin. */
export interface AIProviderModel {
    readonly id: string;
    readonly name?: string;
    readonly capabilities?: readonly AIProviderCapability[];
}

/** Provider-neutral request produced by an activity or mission assistant. */
export interface AIProviderRequest {
    readonly task: AIProviderTaskId;
    /** Activity-scoped context, omitted for mission-wide reflection/synthesis. */
    readonly activity?: ActivityContext;
    /** Mission-scoped context, used by reflection/synthesis and mission games. */
    readonly mission?: MissionAutomationContext;
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

/** Dependency-inversion boundary implemented by model-provider plugins. */
export interface AIProvider {
    readonly id: string;
    readonly name: string;
    readonly capabilities: readonly AIProviderCapability[];
    readonly models?: readonly AIProviderModel[];

    isAvailable?(): boolean | Promise<boolean>;

    generate(request: AIProviderRequest): Promise<AIProviderResult>;
}
