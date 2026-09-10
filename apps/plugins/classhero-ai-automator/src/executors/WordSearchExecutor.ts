import type {
    ClassHero,
    GameMode,
} from "@classhero-cli/api-wrapper";
import {
    getSourceMissionMaterialId,
    requireActivityTarget,
} from "../context/ActivityTargets.js";
import type {
    ActivityContext,
    AutomationExecutionResult,
} from "../contracts/activity.js";
import type {
    AutomationActivityLogger,
} from "../logging/AutomationActivityLogger.js";
import { WordSearchSolver } from "../solvers/WordSearchSolver.js";
import type {
    ExecutionTimingPolicy,
} from "../timing/ExecutionTimingPolicy.js";

/**
 * Executes the deterministic ClassHero word-search workflow.
 *
 * The current observed API exposes `/start` and one final `/submit`, but no
 * per-word validation endpoint. Therefore solved words are paced through local
 * checkpoints and the complete `found_words` payload is sent at the final
 * checkpoint only.
 */
export class WordSearchExecutor {
    constructor(
        private readonly api: ClassHero,
        private readonly timing: ExecutionTimingPolicy,
        private readonly activityLogger: AutomationActivityLogger,
        private readonly solver = new WordSearchSolver(),
    ) {}

    /** Creates, solves, progressively reveals and submits one word-search. */
    async execute(
        context: ActivityContext,
        mode: GameMode,
    ): Promise<AutomationExecutionResult> {
        try {
            const target =
                requireActivityTarget(
                    context,
                    "games",
                );

            const sourceMissionMaterialId =
                getSourceMissionMaterialId(
                    context,
                );

            const started =
                await this.api.games.wordSearch.start({
                    materialId:
                        target.materialId,
                    mode,
                    ...(sourceMissionMaterialId === undefined
                        ? {}
                        : {
                            themeMissionMaterialId:
                                sourceMissionMaterialId,
                        }),
                });

            if (!started.ok) {
                return failed(
                    `Falha ao preparar o caça-palavras (HTTP ${started.status}).`,
                );
            }

            const game =
                started.response;

            const markStarted =
                await this.api.games.wordSearch.markStarted(
                    game.game_id,
                );

            if (!markStarted.ok) {
                return failed(
                    `A rodada foi criada, mas não pôde ser marcada como iniciada (HTTP ${markStarted.status}).`,
                );
            }

            const timingStartedAt =
                Date.now();

            this.activityLogger.wordSearchStarted(
                game,
                mode,
            );

            const solution =
                this.solver.solve(
                    game,
                );

            for (
                const unresolved of
                    solution.unresolved
            ) {
                this.activityLogger.wordSearchUnresolved(
                    unresolved,
                );
            }

            if (
                solution.unresolved.length > 0 ||
                solution.foundWords.length === 0
            ) {
                return failed(
                    "O solver não encontrou todas as palavras; a rodada não foi enviada para evitar pontuação incorreta.",
                    {
                        unresolved:
                            solution.unresolved.map(
                                (item) =>
                                    item.word,
                            ),
                    },
                );
            }

            const schedule =
                await this.timing.getGameProgressSchedule({
                    targetId:
                        "word-search",
                    mode,
                    totalUnits:
                        solution.foundWords.length,
                });

            this.activityLogger.miniGamePacingPlanned({
                game:
                    "Caça-palavras",
                mode,
                enabled:
                    schedule.enabled,
                totalSeconds:
                    schedule.gameMinimumSeconds,
                totalUnits:
                    schedule.totalUnits,
                intervalSeconds:
                    schedule.intervalSeconds,
                unitLabel:
                    "palavra",
            });

            let totalWaitedSeconds = 0;

            /*
             * There is intentionally no partial /submit here. The captured
             * ClassHero API only shows the final submit operation for the
             * complete word-search result.
             */
            for (
                let index = 0;
                index <
                    solution.foundWords.length;
                index++
            ) {
                const foundWord =
                    solution.foundWords[
                        index
                    ];

                if (!foundWord) {
                    continue;
                }

                const checkpoint =
                    await this.timing.waitForGameProgress({
                        targetId:
                            "word-search",
                        mode,
                        startedAt:
                            timingStartedAt,
                        completedUnits:
                            index + 1,
                        totalUnits:
                            solution.foundWords.length,
                    });

                totalWaitedSeconds +=
                    checkpoint.waitedSeconds;

                const keyword =
                    game.key_words[
                        foundWord.wordIndex
                    ];

                if (keyword) {
                    this.activityLogger.wordSearchFound(
                        keyword,
                        foundWord,
                    );
                }
            }

            const submitted =
                await this.api.games.wordSearch.submit({
                    game_id:
                        game.game_id,
                    found_words: [
                        ...solution.foundWords,
                    ],
                    mode,
                    hints_used:
                        0,
                    content_id:
                        game.content_id,
                    material_id:
                        target.materialId,
                });

            if (!submitted.ok) {
                return failed(
                    `Falha ao enviar o caça-palavras (HTTP ${submitted.status}).`,
                );
            }

            return {
                status:
                    "completed",
                targetId:
                    "word-search",
                strategy:
                    "native",
                message:
                    submitted.response.message ||
                    "Caça-palavras concluído.",
                details: {
                    wordsFound:
                        submitted.response.found_correct,
                    totalWords:
                        submitted.response.total_words,
                    score:
                        submitted.response.score,
                    xpAwarded:
                        submitted.response.xp_awarded,
                    alreadyRewarded:
                        submitted.response.already_rewarded,
                    timingEnabled:
                        schedule.enabled,
                    minimumSeconds:
                        schedule.gameMinimumSeconds,
                    checkpointIntervalSeconds:
                        schedule.intervalSeconds,
                    waitedSeconds:
                        roundSeconds(
                            totalWaitedSeconds,
                        ),
                    totalElapsedSeconds:
                        submitted.response.time_seconds,
                },
            };
        } catch (error) {
            return failed(
                error instanceof Error
                    ? error.message
                    : String(error),
            );
        }
    }
}

function roundSeconds(
    seconds: number,
): number {
    return Math.round(
        seconds * 100,
    ) / 100;
}

function failed(
    message: string,
    details?: Readonly<Record<string, unknown>>,
): AutomationExecutionResult {
    return {
        status:
            "failed",
        targetId:
            "word-search",
        strategy:
            "native",
        message,
        ...(details === undefined
            ? {}
            : { details }),
    };
}
