import type { GameMode } from "@classhero-cli/api-wrapper";

/** The three ClassHero game difficulties/modes exposed by the automator UI. */
export type KnownGameMode = "estudo" | "foco" | "desafio";

/** Mini-games that use difficulty-specific minimum durations. */
export type TimedMiniGame = "wordSearch" | "memory" | "hangman";

/** Minimum duration, in seconds, for each ClassHero game difficulty. */
export interface GameDifficultyTiming {
    readonly estudo: number;
    readonly foco: number;
    readonly desafio: number;
}

/** Timing configuration used by future quiz executors. */
export interface QuizTimingConfig {
    /**
     * Minimum time allocated to each question.
     *
     * The future quiz executor will measure from the moment a question starts
     * being processed. Provider/network processing time counts toward this
     * duration; only the remaining time is awaited.
     */
    readonly secondsPerQuestion: number;
}

/**
 * Persistent timing configuration owned by the automator plugin.
 *
 * Timing is disabled by default so upgrading the plugin does not silently
 * change existing execution behavior.
 */
export interface AutomatorTimingConfig {
    readonly enabled: boolean;
    readonly games: Readonly<Record<TimedMiniGame, GameDifficultyTiming>>;
    readonly quiz: QuizTimingConfig;
}

/** Starter values used when no user configuration exists. */
export const DEFAULT_TIMING_CONFIG: AutomatorTimingConfig = {
    enabled: false,
    games: {
        wordSearch: {
            estudo: 30,
            foco: 45,
            desafio: 60,
        },
        memory: {
            estudo: 30,
            foco: 45,
            desafio: 60,
        },
        hangman: {
            estudo: 30,
            foco: 45,
            desafio: 60,
        },
    },
    quiz: {
        secondsPerQuestion: 30,
    },
};

/**
 * Converts a ClassHero `GameMode` into one of the modes configurable by this
 * plugin.
 *
 * Unknown/custom modes fall back to `desafio`, which is the most conservative
 * configured duration.
 */
export function normalizeGameMode(mode: GameMode): KnownGameMode {
    if (mode === "estudo") {
        return "estudo";
    }

    if (mode === "foco") {
        return "foco";
    }

    if (mode === "desafio") {
        return "desafio";
    }

    return "desafio";
}

/** Returns an independent mutable-safe copy of a timing configuration. */
export function cloneTimingConfig(
    config: AutomatorTimingConfig,
): AutomatorTimingConfig {
    return {
        enabled: config.enabled,
        games: {
            wordSearch: { ...config.games.wordSearch },
            memory: { ...config.games.memory },
            hangman: { ...config.games.hangman },
        },
        quiz: {
            ...config.quiz,
        },
    };
}
