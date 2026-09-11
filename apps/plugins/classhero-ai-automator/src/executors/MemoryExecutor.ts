import type {
    ClassHero,
    GameMode,
} from "@classhero-cli/api-wrapper";
import type {
    ActivityContext,
    AutomationExecutionResult,
} from "../contracts/activity.js";
import {
    gameStartPayload,
    materialGameScope,
    missionGameScope,
    type GameExecutionScope,
} from "../contracts/game-scope.js";
import type {
    MissionAutomationContext,
} from "../contracts/mission.js";
import type {
    AutomationActivityLogger,
} from "../logging/AutomationActivityLogger.js";
import { MemorySolver } from "../solvers/MemorySolver.js";
import type {
    ExecutionTimingPolicy,
} from "../timing/ExecutionTimingPolicy.js";

/** Deterministic memory executor for material and mission bonus scopes. */
export class MemoryExecutor {
    constructor(
        private readonly api: ClassHero,
        private readonly timing: ExecutionTimingPolicy,
        private readonly activityLogger: AutomationActivityLogger,
        private readonly solver = new MemorySolver(),
    ) {}

    execute(
        context: ActivityContext,
        mode: GameMode,
    ): Promise<AutomationExecutionResult> {
        return this.executeScope(
            materialGameScope(context),
            mode,
        );
    }

    executeMission(
        mission: MissionAutomationContext,
        mode: GameMode = "desafio",
    ): Promise<AutomationExecutionResult> {
        return this.executeScope(
            missionGameScope(mission),
            mode,
        );
    }

    private async executeScope(
        scope: GameExecutionScope,
        mode: GameMode,
    ): Promise<AutomationExecutionResult> {
        try {
            const started =
                await this.api.games.memory.start(
                    gameStartPayload(scope, mode),
                );

            if (!started.ok) {
                if (started.status === 409) {
                    return blocked(
                        responseMessage(started.response) ??
                        "O ClassHero bloqueou uma nova tentativa do jogo da memória para este escopo/modo.",
                        { scope: scope.kind },
                    );
                }

                return failed(
                    `Falha ao preparar o jogo da memória (HTTP ${started.status}).`,
                );
            }

            const timingStartedAt = Date.now();
            const game = started.response;
            this.activityLogger.memoryStarted(game, mode);

            const solution = this.solver.solve(game);

            solution.pairs.forEach((pair, index) => {
                this.activityLogger.memoryPairFound(
                    pair,
                    index + 1,
                    solution.pairs.length,
                );
            });

            for (const unresolved of solution.unresolved) {
                this.activityLogger.memoryPairUnresolved(unresolved);
            }

            if (
                solution.unresolved.length > 0 ||
                solution.pairs.length === 0
            ) {
                return failed(
                    "O glossário não pôde ser mapeado integralmente para as cartas; a rodada não foi enviada.",
                    {
                        scope: scope.kind,
                        pairsFound: solution.pairs.length,
                        unresolved: solution.unresolved.map((item) => item.word),
                    },
                );
            }

            const schedule =
                await this.timing.getGameProgressSchedule({
                    targetId: "memory",
                    mode,
                    totalUnits: solution.pairs.length,
                });

            this.activityLogger.miniGamePacingPlanned({
                game: scope.kind === "mission"
                    ? "Jogo da memória bônus da missão"
                    : "Jogo da memória",
                mode,
                enabled: schedule.enabled,
                totalSeconds: schedule.gameMinimumSeconds,
                totalUnits: schedule.totalUnits,
                intervalSeconds: schedule.intervalSeconds,
                unitLabel: "par",
            });

            let validatedPairs = 0;
            let totalWaitedSeconds = 0;

            for (let index = 0; index < solution.pairs.length; index++) {
                const pair = solution.pairs[index];
                if (!pair) {
                    continue;
                }

                const checkpoint =
                    await this.timing.waitForGameProgress({
                        targetId: "memory",
                        mode,
                        startedAt: timingStartedAt,
                        completedUnits: index + 1,
                        totalUnits: solution.pairs.length,
                    });

                totalWaitedSeconds += checkpoint.waitedSeconds;

                this.activityLogger.memoryPairValidationStarting(
                    pair,
                    index + 1,
                    solution.pairs.length,
                    checkpoint.checkpointSeconds,
                );

                const validation =
                    await this.api.games.memory.validate({
                        session_id: game.session_id,
                        card_ids: [
                            pair.wordCardId,
                            pair.definitionCardId,
                        ],
                    });

                if (!validation.ok) {
                    return failed(
                        `Falha ao validar um par do jogo da memória (HTTP ${validation.status}).`,
                        { word: pair.word, validatedPairs, scope: scope.kind },
                    );
                }

                if (!validation.response.match) {
                    return failed(
                        "O backend rejeitou um par derivado do próprio glossário; a submissão foi interrompida.",
                        { word: pair.word, validatedPairs, scope: scope.kind },
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
            const elapsedSeconds = realElapsedSeconds(timingStartedAt);

            const submitted =
                await this.api.games.memory.submit({
                    session_id: game.session_id,
                    score,
                    matched_pairs: validatedPairs,
                    wrong_attempts: 0,
                    mode,
                    time_seconds: elapsedSeconds,
                    theme_id: scope.missionId,
                    ...(scope.kind === "mission"
                        ? {}
                        : { material_id: scope.materialId }),
                    context: scope.kind,
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
                message:
                    submitted.response.message ||
                    "Jogo da memória concluído.",
                details: {
                    scope: scope.kind,
                    matchedPairs: validatedPairs,
                    score: submitted.response.score,
                    xpAwarded: submitted.response.xp_awarded,
                    timingEnabled: schedule.enabled,
                    minimumSeconds: schedule.gameMinimumSeconds,
                    checkpointIntervalSeconds: schedule.intervalSeconds,
                    waitedSeconds: roundSeconds(totalWaitedSeconds),
                    totalElapsedSeconds: elapsedSeconds,
                },
            };
        } catch (error) {
            return failed(
                error instanceof Error ? error.message : String(error),
            );
        }
    }
}

function realElapsedSeconds(startedAt: number): number {
    return Math.max(1, Math.ceil((Date.now() - startedAt) / 1000));
}

function roundSeconds(seconds: number): number {
    return Math.round(seconds * 100) / 100;
}

function blocked(
    message: string,
    details?: Readonly<Record<string, unknown>>,
): AutomationExecutionResult {
    return {
        status: "blocked",
        targetId: "memory",
        strategy: "native",
        message,
        ...(details === undefined ? {} : { details }),
    };
}

function responseMessage(
    value: unknown,
): string | undefined {
    if (
        typeof value !== "object" ||
        value === null ||
        Array.isArray(value)
    ) {
        return undefined;
    }

    const message =
        (value as Record<string, unknown>).message;

    return typeof message === "string" &&
        message.trim().length > 0
        ? message
        : undefined;
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
