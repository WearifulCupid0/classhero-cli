import type {
    ClassHero,
    GameMode,
} from "@classhero-cli/api-wrapper";
import type {
    ActivityContext,
    AutomationExecutionResult,
} from "../contracts/activity.js";
import type {
    AutomationActivityLogger,
} from "../logging/AutomationActivityLogger.js";
import { MemorySolver } from "../solvers/MemorySolver.js";
import {
    getSourceMissionMaterialId,
    requireActivityTarget,
} from "../context/ActivityTargets.js";
import type { ExecutionTimingPolicy } from "../timing/ExecutionTimingPolicy.js";

/**
 * Executes the deterministic ClassHero memory-game workflow.
 *
 * Pair discovery uses the glossary returned by the backend. Each discovered
 * pair is still confirmed through `/games/memory/validate` before submission.
 */
export class MemoryExecutor {
    constructor(
        private readonly api: ClassHero,
        private readonly timing: ExecutionTimingPolicy,
        private readonly activityLogger: AutomationActivityLogger,
        private readonly solver = new MemorySolver(),
    ) {}

    /** Creates, logs, validates, paces and submits one memory-game round. */
    async execute(
        context: ActivityContext,
        mode: GameMode,
    ): Promise<AutomationExecutionResult> {
        try {
            const target = requireActivityTarget(context, "games");
            const sourceMissionMaterialId = getSourceMissionMaterialId(context);

            const started = await this.api.games.memory.start({
                materialId: target.materialId,
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

            // The memory session is active after the backend creates it.
            const timingStartedAt = Date.now();
            const game = started.response;

            this.activityLogger.memoryStarted(
                game,
                mode,
            );

            const solution = this.solver.solve(game);

            solution.pairs.forEach((pair, index) => {
                this.activityLogger.memoryPairFound(
                    pair,
                    index + 1,
                    solution.pairs.length,
                );
            });

            for (const unresolved of solution.unresolved) {
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
                        pairsFound: solution.pairs.length,
                        unresolved: solution.unresolved.map(
                            (item) => item.word,
                        ),
                    },
                );
            }

            let validatedPairs = 0;

            for (const pair of solution.pairs) {
                const validation = await this.api.games.memory.validate({
                    session_id: game.session_id,
                    card_ids: [
                        pair.wordCardId,
                        pair.definitionCardId,
                    ],
                });

                if (!validation.ok) {
                    return failed(
                        `Falha ao validar um par do jogo da memória (HTTP ${validation.status}).`,
                        { word: pair.word },
                    );
                }

                if (!validation.response.match) {
                    return failed(
                        "O backend rejeitou um par derivado do próprio glossário; a submissão foi interrompida.",
                        { word: pair.word },
                    );
                }

                validatedPairs++;

                this.activityLogger.memoryPairValidated(
                    pair,
                    validatedPairs,
                    solution.pairs.length,
                );
            }

            const score = Math.round(
                (validatedPairs / solution.pairs.length) * 100,
            );

            const timing = await this.timing.waitForGame({
                targetId: "memory",
                mode,
                startedAt: timingStartedAt,
            });

            // Use measured real elapsed time; no timestamp is fabricated.
            const elapsedSeconds = Math.max(
                1,
                Math.ceil(timing.totalElapsedSeconds),
            );

            const submitted = await this.api.games.memory.submit({
                session_id: game.session_id,
                score,
                matched_pairs: validatedPairs,
                wrong_attempts: 0,
                mode,
                time_seconds: elapsedSeconds,
                theme_id: context.themeId,
                material_id: target.materialId,
                context: "material",
                content_id: game.content_id,
            });

            if (!submitted.ok) {
                return failed(
                    `Falha ao enviar o jogo da memória (HTTP ${submitted.status}).`,
                );
            }

            return {
                status: "completed",
                targetId: "memory",
                strategy: "native",
                message: submitted.response.message || "Jogo da memória concluído.",
                details: {
                    matchedPairs: validatedPairs,
                    score: submitted.response.score,
                    xpAwarded: submitted.response.xp_awarded,
                    timingEnabled: timing.enabled,
                    minimumSeconds: timing.minimumSeconds,
                    waitedSeconds: timing.waitedSeconds,
                    totalElapsedSeconds: timing.totalElapsedSeconds,
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

function failed(
    message: string,
    details?: Readonly<Record<string, unknown>>,
): AutomationExecutionResult {
    return {
        status: "failed",
        targetId: "memory",
        strategy: "native",
        message,
        ...(details === undefined ? {} : { details }),
    };
}
