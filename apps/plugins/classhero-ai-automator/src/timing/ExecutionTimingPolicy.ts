import type { GameMode } from "@classhero-cli/api-wrapper";
import type { AutomationTargetId } from "../contracts/activity.js";
import type { TimingConfigStore } from "./TimingConfigStore.js";
import {
    normalizeGameMode,
    type AutomatorTimingConfig,
    type TimedMiniGame,
} from "./TimingConfig.js";

/** Timing information emitted when the policy actually needs to wait. */
export interface TimingWaitEvent {
    readonly targetId: AutomationTargetId;
    readonly minimumSeconds: number;
    readonly elapsedSeconds: number;
    readonly remainingSeconds: number;
}

/** Result returned after applying one minimum-duration rule. */
export interface TimingWaitResult {
    readonly enabled: boolean;
    readonly minimumSeconds: number;
    readonly elapsedBeforeWaitSeconds: number;
    readonly waitedSeconds: number;
    readonly totalElapsedSeconds: number;
}

/** Dependencies that make the timing policy deterministic and easy to test. */
export interface ExecutionTimingPolicyOptions {
    readonly now?: () => number;
    readonly sleep?: (milliseconds: number) => Promise<void>;
    readonly onWait?: (event: TimingWaitEvent) => void | Promise<void>;
}

/**
 * Applies user-configured minimum durations before an executor submits work.
 *
 * The policy never fabricates timestamps. It measures real elapsed time and
 * sleeps only for the remaining portion of the configured minimum.
 */
export class ExecutionTimingPolicy {
    private readonly now: () => number;
    private readonly sleep: (milliseconds: number) => Promise<void>;
    private readonly onWait: ((
        event: TimingWaitEvent,
    ) => void | Promise<void>) | undefined;

    constructor(
        private readonly store: TimingConfigStore,
        options: ExecutionTimingPolicyOptions = {},
    ) {
        this.now = options.now ?? Date.now;
        this.sleep = options.sleep ?? defaultSleep;
        this.onWait = options.onWait;
    }

    /** Returns the complete current timing configuration. */
    getConfig(): Promise<AutomatorTimingConfig> {
        return this.store.get();
    }

    /**
     * Waits until the configured minimum duration for a mini-game difficulty
     * has elapsed.
     */
    async waitForGame(input: {
        readonly targetId: "word-search" | "memory" | "hangman";
        readonly mode: GameMode;
        readonly startedAt: number;
    }): Promise<TimingWaitResult> {
        const config = await this.store.get();
        const game = toTimedMiniGame(input.targetId);
        const mode = normalizeGameMode(input.mode);
        const minimumSeconds = config.games[game][mode];

        return this.waitForMinimum({
            enabled: config.enabled,
            targetId: input.targetId,
            startedAt: input.startedAt,
            minimumSeconds,
        });
    }

    /**
     * Waits for the configured per-question duration.
     *
     * Future quiz executors should call this once per question using the time
     * at which that question started being processed. AI/network time is
     * therefore included rather than added on top of the configured delay.
     */
    async waitForQuizQuestion(
        questionStartedAt: number,
    ): Promise<TimingWaitResult> {
        const config = await this.store.get();

        return this.waitForMinimum({
            enabled: config.enabled,
            targetId: "quiz",
            startedAt: questionStartedAt,
            minimumSeconds: config.quiz.secondsPerQuestion,
        });
    }

    /** Calculates the minimum total quiz time for display/planning purposes. */
    async getQuizMinimumSeconds(questionCount: number): Promise<number> {
        const config = await this.store.get();
        const count = Math.max(0, Math.floor(questionCount));

        return config.enabled
            ? count * config.quiz.secondsPerQuestion
            : 0;
    }

    private async waitForMinimum(input: {
        readonly enabled: boolean;
        readonly targetId: AutomationTargetId;
        readonly startedAt: number;
        readonly minimumSeconds: number;
    }): Promise<TimingWaitResult> {
        const elapsedBeforeWaitMs = Math.max(
            0,
            this.now() - input.startedAt,
        );

        if (!input.enabled || input.minimumSeconds <= 0) {
            return createResult(
                input.enabled,
                input.minimumSeconds,
                elapsedBeforeWaitMs,
                0,
                elapsedBeforeWaitMs,
            );
        }

        const minimumMs = input.minimumSeconds * 1000;
        const remainingMs = Math.max(
            0,
            minimumMs - elapsedBeforeWaitMs,
        );

        if (remainingMs > 0) {
            await this.onWait?.({
                targetId: input.targetId,
                minimumSeconds: input.minimumSeconds,
                elapsedSeconds: millisecondsToSeconds(
                    elapsedBeforeWaitMs,
                ),
                remainingSeconds: millisecondsToSeconds(
                    remainingMs,
                ),
            });

            await this.sleep(remainingMs);
        }

        const totalElapsedMs = Math.max(
            0,
            this.now() - input.startedAt,
        );

        const actualWaitedMs = Math.max(
            0,
            totalElapsedMs - elapsedBeforeWaitMs,
        );

        return createResult(
            true,
            input.minimumSeconds,
            elapsedBeforeWaitMs,
            actualWaitedMs,
            totalElapsedMs,
        );
    }
}

function toTimedMiniGame(
    targetId: "word-search" | "memory" | "hangman",
): TimedMiniGame {
    switch (targetId) {
        case "word-search":
            return "wordSearch";
        case "memory":
            return "memory";
        case "hangman":
            return "hangman";
    }
}

function createResult(
    enabled: boolean,
    minimumSeconds: number,
    elapsedBeforeWaitMs: number,
    waitedMs: number,
    totalElapsedMs: number,
): TimingWaitResult {
    return {
        enabled,
        minimumSeconds,
        elapsedBeforeWaitSeconds:
            millisecondsToSeconds(elapsedBeforeWaitMs),
        waitedSeconds: millisecondsToSeconds(waitedMs),
        totalElapsedSeconds:
            millisecondsToSeconds(totalElapsedMs),
    };
}

function millisecondsToSeconds(milliseconds: number): number {
    return Math.round((milliseconds / 1000) * 100) / 100;
}

function defaultSleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, milliseconds);
    });
}
