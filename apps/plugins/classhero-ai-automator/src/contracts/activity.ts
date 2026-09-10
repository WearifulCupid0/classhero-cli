import type {
    GameMode,
    ThemeMaterial,
} from "@classhero-cli/api-wrapper";

/**
 * Primary material family derived from the ClassHero `type` field.
 *
 * `kind` remains singular for backwards compatibility, while
 * `ActivityContext.capabilities` can contain several simultaneously.
 */
export type ActivityKind =
    | "games"
    | "quiz"
    | "interactive-path"
    | "code"
    | "discursive"
    | "unknown";

/** Independently automatable feature exposed by one selected activity. */
export type ActivityCapability =
    | "games"
    | "quiz"
    | "interactive-path"
    | "code"
    | "discursive";

/** Execution mechanism selected for one automation target. */
export type AutomationStrategy = "native" | "ai";

/**
 * Concrete action that the automator can reason about.
 *
 * `word-search` and `memory` are deterministic. The remaining targets require
 * semantic interpretation and therefore belong to the AI strategy.
 */
export type AutomationTargetId =
    | "word-search"
    | "memory"
    | "hangman"
    | "quiz"
    | "interactive-path"
    | "code"
    | "discursive";

/** Normalized immutable activity context consumed by planners and executors. */
export interface ActivityContext {
    readonly materialId: string;
    readonly themeId: string;
    readonly themeMissionMaterialId?: string;
    readonly title: string;
    readonly materialType: string;
    /** Primary normalized family derived from `materialType`. */
    readonly kind: ActivityKind;
    /**
     * All automatable features detected for the material.
     *
     * One ClassHero activity can expose both games and quiz behavior.
     */
    readonly capabilities: readonly ActivityCapability[];
    readonly disciplineId?: string;
    readonly disciplineName?: string;
    readonly missionId?: string;
    readonly missionName?: string;
    readonly activity: ThemeMaterial;
}

export interface AutomationTarget {
    readonly id: AutomationTargetId;
    readonly label: string;
    readonly description: string;
    readonly strategy: AutomationStrategy;
    readonly executable: boolean;
}

export interface AutomationPlan {
    readonly context: ActivityContext;
    readonly targets: readonly AutomationTarget[];
    readonly recommendedTargetId?: AutomationTargetId;
    readonly reason: string;
}

export interface NativeGameExecutionOptions {
    readonly mode: GameMode;
}

export type AutomationExecutionStatus =
    | "completed"
    | "blocked"
    | "unsupported"
    | "failed";

export interface AutomationExecutionResult {
    readonly status: AutomationExecutionStatus;
    readonly targetId: AutomationTargetId;
    readonly strategy: AutomationStrategy;
    readonly message: string;
    readonly details?: Readonly<Record<string, unknown>>;
}
