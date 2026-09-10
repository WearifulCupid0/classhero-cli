import type {
    ClassHero,
    GameMode,
    HangmanGuessResponse,
    HangmanPuzzle,
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
import {
    createHangmanProviderRequest,
    parseHangmanAIAnswer,
} from "../prompts/HangmanPrompt.js";
import type {
    AIProvider,
} from "../providers/contracts.js";
import type {
    ExecutionTimingPolicy,
} from "../timing/ExecutionTimingPolicy.js";
import {
    applyHangmanGuess,
    candidateLettersToTry,
    createInitialHangmanKnowledge,
    isAsciiHangmanLetter,
    normalizeCandidateWord,
    normalizeHangmanLetter,
    recordHangmanCandidateFailure,
    validateHangmanCandidate,
    type HangmanKnowledge,
} from "./HangmanKnowledge.js";
import {
    calculateHangmanXpPreview,
} from "./HangmanScoring.js";

const MAX_AI_ROUNDS = 8;

/**
 * AI-backed ClassHero hangman executor.
 *
 * Every AI word is only a hypothesis. Each outbound letter is:
 *
 * 1. normalized to strict A-Z;
 * 2. paced according to the configured game duration;
 * 3. individually submitted to `/games/forca/guess`;
 * 4. classified using the authoritative `wrongCount` transition.
 *
 * At the first newly-proven wrong letter the current candidate is marked
 * incorrect and the complete evidence is sent back to the AI.
 */
export class HangmanExecutor {
    constructor(
        private readonly api: ClassHero,
        private readonly timing: ExecutionTimingPolicy,
        private readonly activityLogger: AutomationActivityLogger,
    ) {}

    /** Generates, reasons over, solves and submits one hangman round. */
    async execute(
        context: ActivityContext,
        mode: GameMode,
        provider: AIProvider,
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

            const response =
                await this.api.games.hangman.puzzle({
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

            if (!response.ok) {
                return failed(
                    `Falha ao preparar a forca (HTTP ${response.status}).`,
                );
            }

            const puzzle =
                response.response.puzzle;

            this.activityLogger.hangmanStarted(
                puzzle,
                mode,
            );

            const timingStartedAt =
                Date.now();

            let backendState =
                createInitialBackendState(
                    puzzle,
                );

            let knowledge =
                createInitialHangmanKnowledge(
                    puzzle,
                );

            let aiRounds = 0;

            while (
                !backendState.won &&
                !backendState.lost &&
                aiRounds < MAX_AI_ROUNDS
            ) {
                aiRounds++;

                this.activityLogger.hangmanReasoningState(
                    aiRounds,
                    knowledge,
                    provider.name,
                );

                const generated =
                    await provider.generate(
                        createHangmanProviderRequest(
                            context,
                            puzzle,
                            knowledge,
                        ),
                    );

                const answer =
                    parseHangmanAIAnswer(
                        generated.data,
                    );

                if (!answer) {
                    return failed(
                        `O provider '${provider.name}' não retornou uma resposta estruturada válida para a forca.`,
                        {
                            providerId:
                                provider.id,
                            aiRounds,
                        },
                    );
                }

                const normalizedCandidate =
                    normalizeCandidateWord(
                        answer.word,
                    );

                this.activityLogger.hangmanAiAnswer(
                    answer.word,
                    normalizedCandidate,
                    provider.name,
                );

                const validation =
                    validateHangmanCandidate(
                        normalizedCandidate,
                        puzzle,
                        knowledge,
                    );

                if (!validation.valid) {
                    const detail =
                        validation.reason ??
                        "a candidata contradiz as evidências atuais";

                    knowledge =
                        recordHangmanCandidateFailure(
                            knowledge,
                            {
                                candidate:
                                    normalizedCandidate,
                                reason:
                                    "local-validation",
                                detail,
                                rejectedLetters: [],
                                maskBefore:
                                    knowledge.mask,
                                maskAfter:
                                    knowledge.mask,
                                wrongCountBefore:
                                    knowledge.wrongCount,
                                wrongCountAfter:
                                    knowledge.wrongCount,
                            },
                        );

                    this.activityLogger.hangmanCandidateRejected(
                        normalizedCandidate ||
                            answer.word,
                        detail,
                    );

                    continue;
                }

                const candidate =
                    validation.normalizedCandidate;

                const letters =
                    candidateLettersToTry(
                        candidate,
                        knowledge,
                    );

                if (
                    letters.length === 0
                ) {
                    const detail =
                        "a palavra não trouxe nenhuma letra A-Z nova para testar";

                    knowledge =
                        recordHangmanCandidateFailure(
                            knowledge,
                            {
                                candidate,
                                reason:
                                    "local-validation",
                                detail,
                                rejectedLetters: [],
                                maskBefore:
                                    knowledge.mask,
                                maskAfter:
                                    knowledge.mask,
                                wrongCountBefore:
                                    knowledge.wrongCount,
                                wrongCountAfter:
                                    knowledge.wrongCount,
                            },
                        );

                    this.activityLogger.hangmanCandidateRejected(
                        candidate,
                        detail,
                    );

                    continue;
                }

                const candidateMaskBefore =
                    knowledge.mask;

                const candidateWrongCountBefore =
                    knowledge.wrongCount;

                /*
                 * Adaptive estimate:
                 * already-sent guesses + remaining letters in this candidate.
                 *
                 * If a candidate fails, the next AI round recalculates this
                 * estimate using the new mask and new candidate. The final
                 * waitForGame() still guarantees the configured total minimum.
                 */
                const plannedTotalGuesses =
                    knowledge.guessHistory.length +
                    letters.length;

                const schedule =
                    await this.timing.getGameProgressSchedule({
                        targetId:
                            "hangman",
                        mode,
                        totalUnits:
                            plannedTotalGuesses,
                    });

                this.activityLogger.hangmanCandidatePacingPlanned({
                    candidate,
                    mode,
                    gameMinimumSeconds:
                        schedule.gameMinimumSeconds,
                    alreadySent:
                        knowledge.guessHistory.length,
                    pendingLetters:
                        letters,
                    plannedTotalGuesses:
                        schedule.totalUnits,
                    intervalSeconds:
                        schedule.intervalSeconds,
                    enabled:
                        schedule.enabled,
                });

                let candidateProvenWrong =
                    false;

                for (
                    const letter of letters
                ) {
                    /*
                     * candidateLettersToTry() already guarantees this, but the
                     * second guard ensures no future refactor can ever send a
                     * non-A-Z character to ClassHero.
                     */
                    const outboundLetter =
                        normalizeHangmanLetter(
                            letter,
                        );

                    if (
                        !isAsciiHangmanLetter(
                            outboundLetter,
                        )
                    ) {
                        return failed(
                            `A letra '${letter}' foi bloqueada porque não pode ser normalizada para A-Z.`,
                        );
                    }

                    const completedUnits =
                        knowledge.guessHistory.length +
                        1;

                    const checkpoint =
                        await this.timing.waitForGameProgress({
                            targetId:
                                "hangman",
                            mode,
                            startedAt:
                                timingStartedAt,
                            completedUnits,
                            totalUnits:
                                plannedTotalGuesses,
                        });

                    this.activityLogger.hangmanGuessValidationStarting(
                        outboundLetter,
                        candidate,
                        completedUnits,
                        plannedTotalGuesses,
                        checkpoint.checkpointSeconds,
                    );

                    const previousKnowledge =
                        knowledge;

                    const guessed =
                        await this.api.games.hangman.guess(
                            outboundLetter,
                            puzzle.puzzle_id,
                        );

                    if (!guessed.ok) {
                        return failed(
                            `Falha ao validar a letra '${outboundLetter}' na forca (HTTP ${guessed.status}).`,
                        );
                    }

                    backendState =
                        guessed.response;

                    const applied =
                        applyHangmanGuess(
                            previousKnowledge,
                            outboundLetter,
                            backendState,
                        );

                    knowledge =
                        applied.knowledge;

                    this.activityLogger.hangmanGuess(
                        applied.evidence,
                        backendState,
                    );

                    if (
                        backendState.won ||
                        backendState.lost
                    ) {
                        break;
                    }

                    if (
                        applied.evidence.outcome ===
                        "wrong"
                    ) {
                        candidateProvenWrong =
                            true;

                        const detail =
                            `A palavra '${candidate}' está incorreta porque a letra '${applied.evidence.letter}' foi rejeitada pelo ClassHero: wrongCount ${applied.evidence.wrongCountBefore} -> ${applied.evidence.wrongCountAfter}. Máscara atual: ${applied.evidence.maskAfter}.`;

                        knowledge =
                            recordHangmanCandidateFailure(
                                knowledge,
                                {
                                    candidate,
                                    reason:
                                        "backend-wrong-letter",
                                    detail,
                                    rejectedLetters: [
                                        applied.evidence
                                            .letter,
                                    ],
                                    maskBefore:
                                        candidateMaskBefore,
                                    maskAfter:
                                        knowledge.mask,
                                    wrongCountBefore:
                                        candidateWrongCountBefore,
                                    wrongCountAfter:
                                        knowledge.wrongCount,
                                },
                            );

                        this.activityLogger.hangmanRetryAfterWrongGuess(
                            candidate,
                            applied.evidence,
                            knowledge,
                        );

                        /*
                         * Do not spend any more attempts on a word hypothesis
                         * that ClassHero has already disproved.
                         */
                        break;
                    }
                }

                if (
                    backendState.won ||
                    backendState.lost
                ) {
                    break;
                }

                if (
                    !candidateProvenWrong
                ) {
                    const detail =
                        `A candidata '${candidate}' não concluiu a palavra mesmo após testar todas as suas letras novas. A máscara atual é '${knowledge.mask}'.`;

                    knowledge =
                        recordHangmanCandidateFailure(
                            knowledge,
                            {
                                candidate,
                                reason:
                                    "did-not-complete",
                                detail,
                                rejectedLetters: [],
                                maskBefore:
                                    candidateMaskBefore,
                                maskAfter:
                                    knowledge.mask,
                                wrongCountBefore:
                                    candidateWrongCountBefore,
                                wrongCountAfter:
                                    knowledge.wrongCount,
                            },
                        );

                    this.activityLogger.hangmanCandidateExhausted(
                        candidate,
                        knowledge,
                    );
                }
            }

            if (
                !backendState.won &&
                !backendState.lost
            ) {
                return failed(
                    "A IA não conseguiu concluir a forca dentro do limite de novas análises; o resultado não foi submetido.",
                    {
                        providerId:
                            provider.id,
                        aiRounds,
                        mask:
                            knowledge.mask,
                        guessed:
                            knowledge.guessedLetters,
                        correctLetters:
                            knowledge.correctLetters,
                        wrongLetters:
                            knowledge.wrongLetters,
                        wrongCount:
                            knowledge.wrongCount,
                        attemptsLeft:
                            knowledge.attemptsLeft,
                        rejectedCandidates:
                            knowledge.rejectedCandidates,
                        candidateFailures:
                            knowledge.candidateFailures,
                    },
                );
            }

            /*
             * Individual guesses are already paced, but this final guard is
             * still necessary when the winning word has fewer unique letters
             * than characters or AI/network processing consumed less than the
             * configured minimum.
             */
            const timing =
                await this.timing.waitForGame({
                    targetId:
                        "hangman",
                    mode,
                    startedAt:
                        timingStartedAt,
                });

            const preview =
                calculateHangmanXpPreview(
                    mode,
                    backendState.wrongCount,
                    0,
                    0,
                );

            const submitted =
                await this.api.games.hangman.submit({
                    puzzleId:
                        puzzle.puzzle_id,
                    won:
                        backendState.won,
                    attempts:
                        backendState.wrongCount,
                    materialId:
                        target.materialId,
                    missionId:
                        context.themeId,
                    context:
                        "material",
                    mode,
                    hintsUsed:
                        0,
                    time_seconds:
                        Math.max(
                            1,
                            Math.ceil(
                                timing.totalElapsedSeconds,
                            ),
                        ),
                    bonusApplied:
                        mode === "desafio" &&
                        preview.multiplierApplied,
                    xpPreview:
                        preview.finalXp,
                    content_id:
                        response.response.content_id,
                    clientGameStatus:
                        "running",
                });

            if (!submitted.ok) {
                return failed(
                    `Falha ao enviar o resultado da forca (HTTP ${submitted.status}).`,
                );
            }

            this.activityLogger.hangmanFinished(
                submitted.response,
                provider.name,
            );

            return {
                status:
                    "completed",
                targetId:
                    "hangman",
                strategy:
                    "ai",
                message:
                    submitted.response.message ||
                    "Forca concluída.",
                details: {
                    providerId:
                        provider.id,
                    providerName:
                        provider.name,
                    aiRounds,
                    won:
                        submitted.response.won,
                    revealedWord:
                        submitted.response.revealed_word,
                    wrongCount:
                        backendState.wrongCount,
                    correctLetters:
                        knowledge.correctLetters,
                    wrongLetters:
                        knowledge.wrongLetters,
                    rejectedCandidates:
                        knowledge.rejectedCandidates,
                    candidateFailures:
                        knowledge.candidateFailures,
                    score:
                        submitted.response.score,
                    xpAwarded:
                        submitted.response.xp_awarded,
                    xpPreview:
                        preview.finalXp,
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
        } catch (error) {
            return failed(
                error instanceof Error
                    ? error.message
                    : String(error),
            );
        }
    }
}

function createInitialBackendState(
    puzzle: HangmanPuzzle,
): HangmanGuessResponse {
    return {
        puzzle_id:
            puzzle.puzzle_id,
        hint:
            puzzle.hint,
        mask:
            puzzle.mask,
        guessed:
            [],
        wrongCount:
            0,
        attemptsLeft:
            6,
        won:
            false,
        lost:
            false,
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
            "hangman",
        strategy:
            "ai",
        message,
        ...(details === undefined
            ? {}
            : { details }),
    };
}
