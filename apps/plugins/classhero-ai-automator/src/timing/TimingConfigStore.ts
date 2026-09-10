import type { PluginStorage } from "@classhero-cli/plugin-api";
import {
    cloneTimingConfig,
    DEFAULT_TIMING_CONFIG,
    type AutomatorTimingConfig,
    type GameDifficultyTiming,
    type TimedMiniGame,
} from "./TimingConfig.js";

const STORAGE_KEY = "timingConfig";

/**
 * Persists and validates the automator timing configuration.
 *
 * The store tolerates missing/older/corrupted partial configuration and
 * always returns a complete object by falling back to defaults field by field.
 */
export class TimingConfigStore {
    constructor(private readonly storage: PluginStorage) {}

    /** Loads the current normalized configuration. */
    async get(): Promise<AutomatorTimingConfig> {
        const raw = await this.storage.get<unknown>(STORAGE_KEY);
        return normalizeConfig(raw);
    }

    /** Replaces the complete configuration after normalizing its values. */
    async set(config: AutomatorTimingConfig): Promise<void> {
        await this.storage.set(STORAGE_KEY, normalizeConfig(config));
    }

    /** Enables or disables timing without changing configured durations. */
    async setEnabled(enabled: boolean): Promise<AutomatorTimingConfig> {
        const current = await this.get();
        const next: AutomatorTimingConfig = {
            ...current,
            enabled,
        };

        await this.set(next);
        return next;
    }

    /** Updates all three difficulty durations for one mini-game. */
    async setGameTiming(
        game: TimedMiniGame,
        timing: GameDifficultyTiming,
    ): Promise<AutomatorTimingConfig> {
        const current = await this.get();
        const next: AutomatorTimingConfig = {
            ...current,
            games: {
                ...current.games,
                [game]: normalizeGameTiming(timing, current.games[game]),
            },
        };

        await this.set(next);
        return next;
    }

    /** Updates the minimum number of seconds allocated to each quiz question. */
    async setQuizSecondsPerQuestion(
        seconds: number,
    ): Promise<AutomatorTimingConfig> {
        const current = await this.get();
        const next: AutomatorTimingConfig = {
            ...current,
            quiz: {
                secondsPerQuestion: normalizeSeconds(
                    seconds,
                    current.quiz.secondsPerQuestion,
                ),
            },
        };

        await this.set(next);
        return next;
    }

    /** Restores the built-in defaults. */
    async reset(): Promise<AutomatorTimingConfig> {
        const next = cloneTimingConfig(DEFAULT_TIMING_CONFIG);
        await this.storage.set(STORAGE_KEY, next);
        return next;
    }
}

function normalizeConfig(value: unknown): AutomatorTimingConfig {
    const defaults = DEFAULT_TIMING_CONFIG;

    if (!isRecord(value)) {
        return cloneTimingConfig(defaults);
    }

    const games = isRecord(value.games)
        ? value.games
        : {};

    const quiz = isRecord(value.quiz)
        ? value.quiz
        : {};

    return {
        enabled: typeof value.enabled === "boolean"
            ? value.enabled
            : defaults.enabled,
        games: {
            wordSearch: normalizeGameTiming(
                games.wordSearch,
                defaults.games.wordSearch,
            ),
            memory: normalizeGameTiming(
                games.memory,
                defaults.games.memory,
            ),
            hangman: normalizeGameTiming(
                games.hangman,
                defaults.games.hangman,
            ),
            anagram: normalizeGameTiming(
                games.anagram,
                defaults.games.anagram,
            ),
        },
        quiz: {
            secondsPerQuestion: normalizeSeconds(
                quiz.secondsPerQuestion,
                defaults.quiz.secondsPerQuestion,
            ),
        },
    };
}

function normalizeGameTiming(
    value: unknown,
    fallback: GameDifficultyTiming,
): GameDifficultyTiming {
    if (!isRecord(value)) {
        return { ...fallback };
    }

    return {
        estudo: normalizeSeconds(value.estudo, fallback.estudo),
        foco: normalizeSeconds(value.foco, fallback.foco),
        desafio: normalizeSeconds(value.desafio, fallback.desafio),
    };
}

function normalizeSeconds(value: unknown, fallback: number): number {
    if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < 0
    ) {
        return fallback;
    }

    return Math.floor(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
