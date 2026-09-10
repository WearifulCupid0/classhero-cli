import type {
    MaterialLevelConfig,
    MaterialLevelsConfig,
    QuizLevel,
} from "@classhero-cli/api-wrapper";
import type {
    ActivityContext,
} from "../contracts/activity.js";

/**
 * Returns the effective quiz-level configuration for one activity.
 *
 * The complete quiz HAR shows `gamified_quiz_xp_config: null` while the real
 * quiz level/question-type configuration is present in `assignment_config`.
 */
export function getQuizLevelsConfig(
    context: ActivityContext,
): MaterialLevelsConfig | undefined {
    const direct =
        context.activity
            .gamified_quiz_xp_config;

    if (direct) {
        return direct;
    }

    if (
        context.capabilities.includes(
            "quiz",
        )
    ) {
        return (
            context.activity
                .assignment_config ??
            undefined
        );
    }

    return undefined;
}

export function getQuizLevelConfig(
    context: ActivityContext,
    level: QuizLevel,
): MaterialLevelConfig | undefined {
    return getQuizLevelsConfig(
        context,
    )?.levels[
        String(level)
    ];
}

export function getEnabledQuizLevels(
    context: ActivityContext,
): readonly {
    readonly id: QuizLevel;
    readonly config: MaterialLevelConfig;
}[] {
    const levels =
        getQuizLevelsConfig(
            context,
        )?.levels;

    if (!levels) {
        return [];
    }

    return Object.entries(levels)
        .filter(
            (
                entry,
            ): entry is [
                string,
                MaterialLevelConfig,
            ] =>
                entry[1] !== undefined &&
                entry[1].enabled,
        )
        .map(
            ([id, config]) => ({
                id: id as QuizLevel,
                config,
            }),
        );
}

export function getDefaultQuizLevel(
    context: ActivityContext,
): QuizLevel {
    const levels =
        getQuizLevelsConfig(
            context,
        )?.levels;

    if (levels?.mixed?.enabled) {
        return "mixed";
    }

    for (const level of [
        "basic",
        "intermediate",
        "advanced",
    ] as const) {
        if (levels?.[level]?.enabled) {
            return level;
        }
    }

    return "mixed";
}

export function getDefaultQuizQuestionCount(
    context: ActivityContext,
    level: QuizLevel,
): number {
    return (
        getQuizLevelConfig(
            context,
            level,
        )?.question_count ??
        10
    );
}
