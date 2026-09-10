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
import { MemorySolver } from "../solvers/MemorySolver.js";
import type {
    ExecutionTimingPolicy,
} from "../timing/ExecutionTimingPolicy.js";

/**
 * Executes the deterministic ClassHero memory-game workflow.
 *
 * The complete solution is calculated locally first, but pair validation is
 * paced across the configured game duration instead of being burst-submitted
 * immediately.
 */
export class MemoryExecutor {
    constructor(
        private readonly api: ClassHero,
        private readonly timing: ExecutionTimingPolicy,
        private readonly activityLogger: AutomationActivityLogger,
        private readonly solver = new MemorySolver(),
    ) {}

    /** Creates, solves, progressively validates and submits one memory round. */
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
                await this.api.games.memory.start({
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
                    `Falha ao preparar o jogo da memória (HTTP ${started.status}).`,
                );
            }

            const timingStartedAt =
                Date.now();

            const game =
                started.response;

            this.activityLogger.memoryStarted(
                game,
                mode,
            );

            const solution =
                this.solver.solve(
                    game,
                );

            /*
             * Solver output is still logged immediately because this is the
             * real local computation. What is paced is communication with the
             * ClassHero validation endpoint.
             */
            solution.pairs.forEach(
                (pair, index) => {
                    this.activityLogger.memoryPairFound(
                        pair,
                        index + 1,
                        solution.pairs.length,
                    );
                },
            );

            for (
                const unresolved of
                    solution.unresolved
            ) {
                this.activityLogger.memoryPairUnresolved(
                    unresolved,
                );
            }

            if (
                solution.unresolved.length > 0 ||
                solution.pairs.length === 0
            ) {
                return failed(
                    "O glossário não pôde ser mapeado integralmente para as cartas; a rodada não foi enviada.",
                    {
                        pairsFound:
                            solution.pairs.length,
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
                        "memory",
                    mode,
                    totalUnits:
                        solution.pairs.length,
                });

            this.activityLogger.miniGamePacingPlanned({
                game:
                    "Jogo da memória",
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
                    "par",
            });

            let validatedPairs = 0;
            let totalWaitedSeconds = 0;

            for (
                let index = 0;
                index <
                    solution.pairs.length;
                index++
            ) {
                const pair =
                    solution.pairs[
                        index
                    ];

                if (!pair) {
                    continue;
                }

                /*
                 * Example:
                 * 60 seconds / 6 pairs -> validate at cumulative deadlines
                 * 10s, 20s, 30s, 40s, 50s and 60s.
                 */
                const checkpoint =
                    await this.timing.waitForGameProgress({
                        targetId:
                            "memory",
                        mode,
                        startedAt:
                            timingStartedAt,
                        completedUnits:
                            index + 1,
                        totalUnits:
                            solution.pairs.length,
                    });

                totalWaitedSeconds +=
                    checkpoint.waitedSeconds;

                this.activityLogger.memoryPairValidationStarting(
                    pair,
                    index + 1,
                    solution.pairs.length,
                    checkpoint.checkpointSeconds,
                );

                const validation =
                    await this.api.games.memory.validate({
                        session_id:
                            game.session_id,
                        card_ids: [
                            pair.wordCardId,
                            pair.definitionCardId,
                        ],
                    });

                if (!validation.ok) {
                    return failed(
                        `Falha ao validar um par do jogo da memória (HTTP ${validation.status}).`,
                        {
                            word:
                                pair.word,
                            validatedPairs,
                        },
                    );
                }

                if (
                    !validation.response.match
                ) {
                    return failed(
                        "O backend rejeitou um par derivado do próprio glossário; a submissão foi interrompida.",
                        {
                            word:
                                pair.word,
                            validatedPairs,
                        },
                    );
                }

                validatedPairs++;

                this.activityLogger.memoryPairValidated(
                    pair,
                    validatedPairs,
                    solution.pairs.length,
                );
            }

            const score =
                Math.round(
                    (
                        validatedPairs /
                        solution.pairs.length
                    ) * 100,
                );

            /*
             * Last validation happens at the final pacing checkpoint. Network
             * time spent validating also counts toward the real game duration.
             */
            const elapsedSeconds =
                realElapsedSeconds(
                    timingStartedAt,
                );

            const submitted =
                await this.api.games.memory.submit({
                    session_id:
                        game.session_id,
                    score,
                    matched_pairs:
                        validatedPairs,
                    wrong_attempts:
                        0,
                    mode,
                    time_seconds:
                        elapsedSeconds,
                    theme_id:
                        context.themeId,
                    material_id:
                        target.materialId,
                    context:
                        "material",
                    content_id:
                        game.content_id,
                });

            if (!submitted.ok) {
                return failed(
                    `Falha ao enviar o jogo da memória (HTTP ${submitted.status}).`,
                );
            }

            return {
                status:
                    "completed",
                targetId:
                    "memory",
                strategy:
                    "native",
                message:
                    submitted.response.message ||
                    "Jogo da memória concluído.",
                details: {
                    matchedPairs:
                        validatedPairs,
                    score:
                        submitted.response.score,
                    xpAwarded:
                        submitted.response.xp_awarded,
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
                        elapsedSeconds,
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

function realElapsedSeconds(
    startedAt: number,
): number {
    return Math.max(
        1,
        Math.ceil(
            (
                Date.now() -
                startedAt
            ) / 1000,
        ),
    );
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
            "memory",
        strategy:
            "native",
        message,
        ...(details === undefined
            ? {}
            : { details }),
    };
}
