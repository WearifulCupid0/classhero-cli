import type {
    AnagramPuzzleResponse,
    AnagramSubmitResponse,
    ClassHero,
    GameMode,
} from "@classhero-cli/api-wrapper";
import type {
    ActivityContext,
    AutomationExecutionResult,
} from "../contracts/activity.js";
import {
    materialGameScope,
} from "../contracts/game-scope.js";
import {
    calculateAnagramXpPreview,
} from "./AnagramScoring.js";
import {
    createAnagramProviderRequest,
    parseAnagramAIAnswer,
    validateAnagramAnswer,
    type AnagramCandidateFailure,
} from "../prompts/AnagramPrompt.js";
import type {
    AIProvider,
} from "../providers/contracts.js";
import type {
    ExecutionTimingPolicy,
    TimingWaitResult,
} from "../timing/ExecutionTimingPolicy.js";

interface MutableLetterPiece {
    letter: string;
    locked: boolean;
}

interface AnagramRuntimeState {
    wrongSubmitCount: number;
    hintsUsed: number;
    emergencyHintsUsed: number;
}

interface StudyRevealResult {
    readonly answer: string;
    readonly hintsUsed: number;
    readonly emergencyHintsUsed: number;
}

/**
 * AI-backed material Anagram executor.
 *
 * Focus/Challenge never call `/reveal-letter`, because the live frontend
 * contract can spend pedagogical credits and/or apply hint penalties. Study
 * mode may use the zero-XP-penalty reveal endpoint only as a deterministic
 * fallback after the AI candidates are exhausted.
 */
export class AnagramExecutor {
    constructor(
        private readonly api:
            ClassHero,
        private readonly timing:
            ExecutionTimingPolicy,
    ) {}

    async execute(
        context: ActivityContext,
        mode: GameMode,
        provider: AIProvider,
    ): Promise<AutomationExecutionResult> {
        try {
            const scope =
                materialGameScope(
                    context,
                );

            if (
                scope.kind !==
                "material"
            ) {
                return failed(
                    "O executor de Anagrama atual suporta somente atividades vinculadas a material.",
                );
            }

            const started =
                await this.api.games.anagram.puzzle({
                    materialId:
                        scope.materialId,
                    mode,
                    ...(scope.themeMissionMaterialId ===
                    undefined
                        ? {}
                        : {
                            themeMissionMaterialId:
                                scope.themeMissionMaterialId,
                        }),
                });

            if (!started.ok) {
                if (
                    started.status ===
                    409
                ) {
                    return blocked(
                        responseMessage(
                            started.response,
                        ) ??
                            "O ClassHero bloqueou uma nova tentativa de Anagrama para este material/modo.",
                    );
                }

                return failed(
                    `Falha ao preparar o Anagrama (HTTP ${started.status}).`,
                );
            }

            const puzzle =
                started.response;

            if (
                puzzle.scrambled_groups
                    .length === 0 ||
                puzzle.scrambled_groups.some(
                    (group) =>
                        group.length ===
                        0,
                )
            ) {
                return failed(
                    "O ClassHero retornou um Anagrama sem grupos de letras utilizáveis.",
                );
            }

            const timingStartedAt =
                Date.now();

            const failures:
                AnagramCandidateFailure[] =
                [];

            const state:
                AnagramRuntimeState = {
                wrongSubmitCount:
                    0,
                hintsUsed:
                    0,
                emergencyHintsUsed:
                    0,
            };

            const submitLimit =
                submissionLimit(
                    mode,
                );

            const generationLimit =
                submitLimit * 3;

            let submittedCandidates =
                0;

            for (
                let generationRound =
                    1;
                generationRound <=
                    generationLimit &&
                submittedCandidates <
                    submitLimit;
                generationRound++
            ) {
                const generated =
                    await provider.generate(
                        createAnagramProviderRequest(
                            context,
                            puzzle,
                            failures,
                        ),
                    );

                const answer =
                    parseAnagramAIAnswer(
                        generated.data,
                    );

                if (!answer) {
                    failures.push({
                        answer:
                            "(resposta estruturada inválida)",
                        reason:
                            "local-validation",
                        detail:
                            `O provider '${provider.name}' não retornou answer/confidence válidos.`,
                    });
                    continue;
                }

                const validation =
                    validateAnagramAnswer(
                        answer.answer,
                        puzzle,
                    );

                if (
                    !validation.valid
                ) {
                    failures.push({
                        answer:
                            validation.normalizedAnswer ||
                            answer.answer,
                        reason:
                            "local-validation",
                        detail:
                            validation.reason ??
                            "A candidata não corresponde às letras do puzzle.",
                    });
                    continue;
                }

                if (
                    failures.some(
                        (failure) =>
                            failure.answer ===
                            validation.normalizedAnswer,
                    )
                ) {
                    failures.push({
                        answer:
                            validation.normalizedAnswer,
                        reason:
                            "local-validation",
                        detail:
                            "O provider repetiu uma candidata já rejeitada.",
                    });
                    continue;
                }

                submittedCandidates++;

                const timing =
                    await this.timing.waitForGame({
                        targetId:
                            "anagram",
                        mode,
                        startedAt:
                            timingStartedAt,
                    });

                const submitted =
                    await this.submitCandidate(
                        scope,
                        puzzle,
                        mode,
                        validation.normalizedAnswer,
                        state,
                        timing,
                    );

                if (!submitted.ok) {
                    if (
                        submitted.status ===
                        409
                    ) {
                        return blocked(
                            responseMessage(
                                submitted.response,
                            ) ??
                                "O ClassHero bloqueou a submissão do Anagrama para este material/modo.",
                        );
                    }

                    return failed(
                        `Falha ao validar o Anagrama (HTTP ${submitted.status}).`,
                    );
                }

                const result =
                    submitted.response;

                if (
                    result.won ===
                    true
                ) {
                    return completed(
                        result,
                        provider,
                        state,
                        timing,
                        failures,
                    );
                }

                state.wrongSubmitCount =
                    finiteNonNegativeInteger(
                        result.wrong_submit_count,
                        state.wrongSubmitCount +
                            1,
                    );

                failures.push({
                    answer:
                        validation.normalizedAnswer,
                    reason:
                        "backend-rejected",
                    detail:
                        result.message ??
                        "O ClassHero marcou a resposta como incorreta.",
                });
            }

            if (
                mode !==
                "estudo"
            ) {
                return failed(
                    mode ===
                        "desafio"
                        ? "A IA não resolveu o Anagrama dentro do limite de tentativas que preserva o bônus sem dicas do modo Desafio; nenhuma dica paga foi utilizada."
                        : "A IA não resolveu o Anagrama dentro do limite de tentativas sem penalidade adicional do modo Foco; nenhuma dica paga foi utilizada.",
                    {
                        providerId:
                            provider.id,
                        providerName:
                            provider.name,
                        wrongSubmitCount:
                            state.wrongSubmitCount,
                        failedCandidates:
                            failures,
                    },
                );
            }

            const revealed =
                await this.revealStudyAnswer(
                    puzzle,
                );

            if (!revealed.ok) {
                return failed(
                    revealed.message,
                    {
                        providerId:
                            provider.id,
                        providerName:
                            provider.name,
                        wrongSubmitCount:
                            state.wrongSubmitCount,
                        failedCandidates:
                            failures,
                    },
                );
            }

            state.hintsUsed +=
                revealed.result.hintsUsed;
            state.emergencyHintsUsed +=
                revealed.result
                    .emergencyHintsUsed;

            const timing =
                await this.timing.waitForGame({
                    targetId:
                        "anagram",
                    mode,
                    startedAt:
                        timingStartedAt,
                });

            const submitted =
                await this.submitCandidate(
                    scope,
                    puzzle,
                    mode,
                    revealed.result.answer,
                    state,
                    timing,
                );

            if (!submitted.ok) {
                return failed(
                    `Falha ao enviar o Anagrama após a revelação determinística do modo Estudo (HTTP ${submitted.status}).`,
                );
            }

            if (
                submitted.response.won !==
                true
            ) {
                return failed(
                    submitted.response.message ??
                    "Mesmo após revelar todas as posições no modo Estudo, o ClassHero não marcou o Anagrama como concluído.",
                );
            }

            return completed(
                submitted.response,
                provider,
                state,
                timing,
                failures,
                true,
            );
        } catch (error) {
            return failed(
                error instanceof Error
                    ? error.message
                    : String(error),
            );
        }
    }

    private submitCandidate(
        scope: Extract<
            ReturnType<
                typeof materialGameScope
            >,
            {
                readonly kind:
                    "material";
            }
        >,
        puzzle: AnagramPuzzleResponse,
        mode: GameMode,
        answer: string,
        state: AnagramRuntimeState,
        timing: TimingWaitResult,
    ) {
        const preview =
            calculateAnagramXpPreview(
                mode,
                state.wrongSubmitCount,
                state.hintsUsed,
                state.emergencyHintsUsed,
            );

        return this.api.games.anagram.submit({
            puzzleId:
                puzzle.puzzle_id,
            answer,
            materialId:
                scope.materialId,
            missionId:
                scope.missionId,
            context:
                "material",
            mode,
            time_seconds:
                Math.max(
                    1,
                    Math.ceil(
                        timing.totalElapsedSeconds,
                    ),
                ),
            hintsUsed:
                state.hintsUsed,
            bonusApplied:
                mode ===
                    "desafio" &&
                preview.multiplierApplied,
            xpPreview:
                preview.finalXp,
            content_id:
                puzzle.content_id,
            ...(scope.themeMissionMaterialId ===
            undefined
                ? {}
                : {
                    themeMissionMaterialId:
                        scope.themeMissionMaterialId,
                }),
            clientGameStatus:
                "playing",
        });
    }

    private async revealStudyAnswer(
        puzzle: AnagramPuzzleResponse,
    ): Promise<
        | {
            readonly ok: true;
            readonly result: StudyRevealResult;
        }
        | {
            readonly ok: false;
            readonly message: string;
        }
    > {
        const groups:
            MutableLetterPiece[][] =
            puzzle.scrambled_groups.map(
                (group) =>
                    group.map(
                        (letter) => ({
                            letter,
                            locked:
                                false,
                        }),
                    ),
            );

        const totalLetters =
            groups.reduce(
                (sum, group) =>
                    sum +
                    group.length,
                0,
            );

        let hintsUsed = 0;
        let emergencyHintsUsed = 0;
        let revealedCount = 0;

        for (
            let call = 0;
            call <
                totalLetters + 2 &&
            revealedCount <
                totalLetters;
            call++
        ) {
            const response =
                await this.api.games.anagram.revealLetter(
                    puzzle.puzzle_id,
                );

            if (!response.ok) {
                return {
                    ok: false,
                    message:
                        `Falha ao revelar uma posição do Anagrama em modo Estudo (HTTP ${response.status}).`,
                };
            }

            const reveal =
                response.response;

            /*
             * The captured Study contract reports cost=0, penalty_points=0
             * and emergency=false. If that invariant changes, stop rather than
             * silently spending credits or applying a penalty.
             */
            if (
                finiteNumber(
                    reveal.cost,
                ) > 0 ||
                finiteNumber(
                    reveal.penalty_points,
                ) > 0 ||
                reveal.emergency ===
                    true
            ) {
                return {
                    ok: false,
                    message:
                        "O ClassHero passou a cobrar ou penalizar a ajuda do Anagrama no modo Estudo; a automação foi interrompida preventivamente.",
                };
            }

            if (
                !applyReveal(
                    groups,
                    reveal.word_index,
                    reveal.position,
                    reveal.letter,
                )
            ) {
                return {
                    ok: false,
                    message:
                        "O ClassHero retornou uma posição/letra de Anagrama incompatível com os grupos recebidos no início da rodada.",
                };
            }

            hintsUsed++;


            revealedCount =
                Math.max(
                    revealedCount,
                    finiteNonNegativeInteger(
                        reveal.revealed_count,
                        hintsUsed,
                    ),
                );
        }

        if (
            revealedCount <
            totalLetters ||
            groups.some(
                (group) =>
                    group.some(
                        (piece) =>
                            !piece.locked,
                    ),
            )
        ) {
            return {
                ok: false,
                message:
                    "O endpoint de ajuda não revelou todas as posições necessárias para concluir o Anagrama do modo Estudo.",
            };
        }

        return {
            ok: true,
            result: {
                answer:
                    groups
                        .map(
                            (group) =>
                                group
                                    .map(
                                        (piece) =>
                                            piece.letter,
                                    )
                                    .join(""),
                        )
                        .join(" ")
                        .normalize(
                            "NFC",
                        )
                        .toLocaleUpperCase(
                            "pt-BR",
                        ),
                hintsUsed,
                emergencyHintsUsed,
            },
        };
    }
}

function submissionLimit(
    mode: GameMode,
): number {
    if (
        mode ===
        "desafio"
    ) {
        /* Stop at two wrong submissions so a future correct attempt can still keep the full no-hint preview. */
        return 2;
    }

    if (
        mode ===
        "foco"
    ) {
        /* Stop at three wrong submissions so a future correct attempt can still avoid the extra-error penalty. */
        return 3;
    }

    return 3;
}

function applyReveal(
    groups: MutableLetterPiece[][],
    wordIndex: number,
    position: number,
    expectedLetter: string,
): boolean {
    const group =
        groups[wordIndex];

    if (
        !group ||
        position < 0 ||
        position >=
            group.length
    ) {
        return false;
    }

    const normalizedExpected =
        normalizeLetter(
            expectedLetter,
        );

    const target =
        group[position];

    if (!target) {
        return false;
    }

    if (
        normalizeLetter(
            target.letter,
        ) ===
        normalizedExpected
    ) {
        target.locked =
            true;
        return true;
    }

    const sourceIndex =
        group.findIndex(
            (piece, index) =>
                index !==
                    position &&
                !piece.locked &&
                normalizeLetter(
                    piece.letter,
                ) ===
                    normalizedExpected,
        );

    if (
        sourceIndex < 0
    ) {
        return false;
    }

    const source =
        group[sourceIndex];

    if (!source) {
        return false;
    }

    group[sourceIndex] =
        target;
    group[position] =
        source;
    source.locked =
        true;

    return true;
}

function normalizeLetter(
    value: string,
): string {
    return value
        .normalize("NFC")
        .toLocaleUpperCase(
            "pt-BR",
        );
}

function completed(
    result: AnagramSubmitResponse,
    provider: AIProvider,
    state: AnagramRuntimeState,
    timing: TimingWaitResult,
    failures: readonly AnagramCandidateFailure[],
    usedStudyRevealFallback = false,
): AutomationExecutionResult {
    return {
        status:
            "completed",
        targetId:
            "anagram",
        strategy:
            "ai",
        message:
            result.message ??
            "Anagrama concluído.",
        details: {
            providerId:
                provider.id,
            providerName:
                provider.name,
            won:
                result.won,
            revealedTerm:
                result.revealed_term,
            score:
                result.score,
            xpAwarded:
                result.xp_awarded,
            attemptId:
                result.attempt_id,
            wrongSubmitCount:
                state.wrongSubmitCount,
            hintsUsed:
                state.hintsUsed,
            emergencyHintsUsed:
                state.emergencyHintsUsed,
            allowRetry:
                result.allow_retry,
            usedStudyRevealFallback,
            failedCandidates: [
                ...failures,
            ],
            timingEnabled:
                timing.enabled,
            minimumSeconds:
                timing.minimumSeconds,
            waitedSeconds:
                timing.waitedSeconds,
            totalElapsedSeconds:
                timing.totalElapsedSeconds,
        },
    };
}

function blocked(
    message: string,
): AutomationExecutionResult {
    return {
        status:
            "blocked",
        targetId:
            "anagram",
        strategy:
            "ai",
        message,
    };
}

function failed(
    message: string,
    details?: Readonly<Record<string, unknown>>,
): AutomationExecutionResult {
    return {
        status:
            "failed",
        targetId:
            "anagram",
        strategy:
            "ai",
        message,
        ...(details ===
        undefined
            ? {}
            : {
                details,
            }),
    };
}

function responseMessage(
    value: unknown,
): string | undefined {
    if (
        typeof value !==
            "object" ||
        value === null ||
        Array.isArray(value)
    ) {
        return undefined;
    }

    const message =
        (value as Record<string, unknown>)
            .message;

    return typeof message ===
        "string" &&
        message.trim().length >
            0
        ? message
        : undefined;
}

function finiteNonNegativeInteger(
    value: unknown,
    fallback: number,
): number {
    return typeof value ===
        "number" &&
        Number.isFinite(value)
        ? Math.max(
            0,
            Math.floor(value),
        )
        : fallback;
}

function finiteNumber(
    value: unknown,
): number {
    return typeof value ===
        "number" &&
        Number.isFinite(value)
        ? value
        : 0;
}
