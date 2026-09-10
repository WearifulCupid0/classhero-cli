import type { ThemeMaterial } from "@classhero-cli/api-wrapper";
import type {
    CliContextSnapshot,
    CliSelectedEntity,
} from "@classhero-cli/plugin-api";
import type {
    ActivityCapability,
    ActivityContext,
    ActivityKind,
} from "../contracts/activity.js";

export class ActivityContextFactory {
    fromCliSnapshot(snapshot: CliContextSnapshot): ActivityContext | undefined {
        const selected = snapshot.activity;
        if (!selected || !isThemeMaterial(selected.value)) {
            return undefined;
        }

        return this.fromMaterial(
            selected.value,
            snapshot.discipline,
            snapshot.mission,
        );
    }

    fromMaterial(
        activity: ThemeMaterial,
        discipline?: CliSelectedEntity,
        mission?: CliSelectedEntity,
    ): ActivityContext {
        const themeMissionMaterialId = firstString(
            activity.theme_mission_material_id,
            activity.themeMissionMaterialId,
        );

        const kind = classifyActivity(activity);

        return {
            materialId: activity.material_id,
            themeId: activity.theme_id,
            ...(themeMissionMaterialId === undefined
                ? {}
                : { themeMissionMaterialId }),
            title: activity.title,
            materialType: activity.type,
            kind,
            capabilities: detectActivityCapabilities(
                activity,
                kind,
            ),
            ...(discipline === undefined
                ? {}
                : {
                    disciplineId: discipline.id,
                    ...(discipline.name === undefined
                        ? {}
                        : { disciplineName: discipline.name }),
                }),
            ...(mission === undefined
                ? {}
                : {
                    missionId: mission.id,
                    ...(mission.name === undefined
                        ? {}
                        : { missionName: mission.name }),
                }),
            activity,
        };
    }
}

/** Classifies the primary raw material type. */
export function classifyActivity(activity: ThemeMaterial): ActivityKind {
    const type = normalizeType(activity.type);

    if (type === "games" || type === "game") {
        return "games";
    }

    if (type.includes("quiz")) {
        return "quiz";
    }

    if (
        type.includes("interactive_path") ||
        type.includes("interactive-path") ||
        type.includes("interactive path")
    ) {
        return "interactive-path";
    }

    if (
        type.includes("code") ||
        typeof activity.code_challenge_language === "string"
    ) {
        return "code";
    }

    if (
        type.includes("assignment") ||
        type.includes("discursive") ||
        (
            activity.assignment !== null &&
            activity.assignment !== undefined
        )
    ) {
        return "discursive";
    }

    return "unknown";
}

/**
 * Detects all supported features instead of assuming one mutually-exclusive
 * activity family.
 */
export function detectActivityCapabilities(
    activity: ThemeMaterial,
    primaryKind: ActivityKind = classifyActivity(activity),
): readonly ActivityCapability[] {
    const result = new Set<ActivityCapability>();

    if (primaryKind !== "unknown") {
        result.add(primaryKind);
    }

    const type = normalizeType(activity.type);

    const hasQuizConfiguration =
        activity.gamified_quiz_xp_config !== null ||
        (
            (primaryKind === "games" || primaryKind === "quiz") &&
            activity.assignment_config !== null &&
            hasQuestionConfiguration(
                activity.assignment_config,
            )
        );

    if (
        type.includes("quiz") ||
        hasQuizConfiguration
    ) {
        result.add("quiz");
    }

    const hasGameProgress =
        positive(activity.game_xp_possible) ||
        positive(activity.game_xp_earned) ||
        activity.score_accepted_for_game === true ||
        activity.games_all_non_study_modes_completed === true;

    if (
        primaryKind === "games" ||
        (
            primaryKind === "quiz" &&
            hasGameProgress
        )
    ) {
        result.add("games");
    }

    return [...result];
}

function hasQuestionConfiguration(
    config: ThemeMaterial["assignment_config"],
): boolean {
    if (!config) {
        return false;
    }

    return Object.values(
        config.levels,
    ).some(
        (level) =>
            level?.enabled === true &&
            Array.isArray(level.question_types) &&
            level.question_types.length > 0,
    );
}

function positive(
    value: number | null | undefined,
): boolean {
    return (
        typeof value === "number" &&
        Number.isFinite(value) &&
        value > 0
    );
}

function normalizeType(value: string): string {
    return value.trim().toLowerCase();
}

function isThemeMaterial(value: unknown): value is ThemeMaterial {
    if (!isRecord(value)) {
        return false;
    }

    return [
        "material_id",
        "theme_id",
        "type",
        "title",
    ].every((key) => typeof value[key] === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstString(...values: readonly unknown[]): string | undefined {
    return values.find(
        (value): value is string =>
            typeof value === "string" && value.length > 0,
    );
}
