import type {
    GameMode,
    ThemeMaterial,
} from "@classhero-cli/api-wrapper";

export type ActivityKind =
    | "games"
    | "quiz"
    | "interactive-path"
    | "code"
    | "discursive"
    | "unknown";

export type ActivityCapability = Exclude<ActivityKind, "unknown">;
export type AutomationStrategy = "native" | "ai";

export type AutomationTargetId =
    | "word-search"
    | "memory"
    | "hangman"
    | "quiz"
    | "interactive-path"
    | "code"
    | "discursive";

/** One concrete ThemeMaterial backing one executable capability. */
export interface ActivityTargetContext {
    readonly capability: ActivityCapability;
    readonly materialId: string;
    readonly materialType: string;
    readonly title: string;
    readonly activity: ThemeMaterial;
}

/**
 * Normalized logical activity consumed by the automator.
 *
 * `targets` is the source of truth. Compatibility fields (`materialId`,
 * `materialType`, `kind`, `activity`) point to the primary target so older
 * plugin code keeps working.
 */
export interface ActivityContext {
    readonly materialId: string;
    readonly themeId: string;
    readonly themeMissionMaterialId?: string;
    readonly sourceMissionMaterialId?: string;
    readonly sourceTitle?: string;
    readonly title: string;
    readonly materialType: string;
    readonly kind: ActivityKind;
    readonly capabilities: readonly ActivityCapability[];
    readonly targets: readonly ActivityTargetContext[];
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
