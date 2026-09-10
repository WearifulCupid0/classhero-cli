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
import { WordSearchSolver } from "../solvers/WordSearchSolver.js";
import type { ExecutionTimingPolicy } from "../timing/ExecutionTimingPolicy.js";

/**
 * Executes the complete deterministic ClassHero word-search workflow.
 */
export class WordSearchExecutor {
    constructor(
        private readonly api: ClassHero,
        private readonly timing: ExecutionTimingPolicy,
        private readonly activityLogger: AutomationActivityLogger,
        private readonly solver = new WordSearchSolver(),
    ) {}

    /** Creates, solves, logs, paces and submits one word-search round. */
    async execute(
        context: ActivityContext,
        mode: GameMode,
    ): Promise<AutomationExecutionResult> {
        try {
            const started = await this.api.games.wordSearch.start({
                materialId: context.materialId,
                mode,
                ...(context.themeMissionMaterialId === undefined
                    ? {}
                    : {
                        themeMissionMaterialId:
                            context.themeMissionMaterialId,
                    }),
            });

            if (!started.ok) {
                return failed(
                    `Falha ao preparar o caça-palavras (HTTP ${started.status}).`,
                );
            }

            const game = started.response;

            const markStarted = await this.api.games.wordSearch.markStarted(
                game.game_id,
            );

            if (!markStarted.ok) {
                return failed(
                    `A rodada foi criada, mas não pôde ser marcada como iniciada (HTTP ${markStarted.status}).`,
                );
            }

            // Timing starts only after the backend has accepted /start.
            const timingStartedAt = Date.now();

            this.activityLogger.wordSearchStarted(
                game,
                mode,
            );

            const solution = this.solver.solve(game);

            for (const foundWord of solution.foundWords) {
                const keyword = game.key_words[
                    foundWord.wordIndex
                ];

                if (keyword) {
                    this.activityLogger.wordSearchFound(
                        keyword,
                        foundWord,
                    );
                }
            }

            for (const unresolved of solution.unresolved) {
                this.activityLogger.wordSearchUnresolved(
                    unresolved,
                );
            }

            if (solution.unresolved.length > 0) {
                return failed(
                    "O solver não encontrou todas as palavras; a rodada não foi enviada para evitar pontuação incorreta.",
                    {
                        unresolved: solution.unresolved.map(
                            (item) => item.word,
                        ),
                    },
                );
            }

            const timing = await this.timing.waitForGame({
                targetId: "word-search",
                mode,
                startedAt: timingStartedAt,
            });

            const submitted = await this.api.games.wordSearch.submit({
                game_id: game.game_id,
                found_words: [...solution.foundWords],
                mode,
                hints_used: 0,
                content_id: game.content_id,
                material_id: context.materialId,
            });

            if (!submitted.ok) {
                return failed(
                    `Falha ao enviar o caça-palavras (HTTP ${submitted.status}).`,
                );
            }

            return {
                status: "completed",
                targetId: "word-search",
                strategy: "native",
                message: submitted.response.message || "Caça-palavras concluído.",
                details: {
                    wordsFound: submitted.response.found_correct,
                    totalWords: submitted.response.total_words,
                    score: submitted.response.score,
                    xpAwarded: submitted.response.xp_awarded,
                    alreadyRewarded: submitted.response.already_rewarded,
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
        targetId: "word-search",
        strategy: "native",
        message,
        ...(details === undefined ? {} : { details }),
    };
}
