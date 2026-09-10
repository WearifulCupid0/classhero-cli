import type {
    ClassHero,
    GameMode,
    HangmanGuessResponse,
    HangmanPuzzle,
} from "@classhero-cli/api-wrapper";
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
import {
    getSourceMissionMaterialId,
    requireActivityTarget,
} from "../context/ActivityTargets.js";
import type {
    ExecutionTimingPolicy,
} from "../timing/ExecutionTimingPolicy.js";
import {
    applyHangmanGuess,
    candidateLettersToTry,
    createInitialHangmanKnowledge,
    rejectHangmanCandidate,
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
 * Every provider answer is only a hypothesis. ClassHero's `mask` and
 * `wrongCount` transitions are the source of truth. At the first newly-proven
 * wrong letter the current candidate is abandoned and the updated evidence is
 * sent back to the AI for a different word.
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
            const target = requireActivityTarget(context, "games");
            const sourceMissionMaterialId = getSourceMissionMaterialId(context);

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

                this.activityLogger.hangmanAiAnswer(
                    answer.word,
                    provider.name,
                );

                const validation =
                    validateHangmanCandidate(
                        answer.word,
                        puzzle,
                        knowledge,
                    );

                if (!validation.valid) {
                    knowledge =
                        rejectHangmanCandidate(
                            knowledge,
                            answer.word,
                        );

                    this.activityLogger.hangmanCandidateRejected(
                        answer.word,
                        validation.reason ??
                            "a candidata contradiz as evidências atuais",
                    );

                    continue;
                }

                const letters =
                    candidateLettersToTry(
                        answer.word,
                        knowledge,
                    );

                if (letters.length === 0) {
                    knowledge =
                        rejectHangmanCandidate(
                            knowledge,
                            answer.word,
                        );

                    this.activityLogger.hangmanCandidateRejected(
                        answer.word,
                        "a palavra não trouxe nenhuma letra nova para testar",
                    );

                    continue;
                }

                let candidateProvenWrong =
                    false;

                for (const letter of letters) {
                    const previousKnowledge =
                        knowledge;

                    const guessed =
                        await this.api.games.hangman.guess(
                            letter,
                            puzzle.puzzle_id,
                        );

                    if (!guessed.ok) {
                        return failed(
                            `Falha ao validar a letra '${letter}' na forca (HTTP ${guessed.status}).`,
                        );
                    }

                    backendState =
                        guessed.response;

                    const applied =
                        applyHangmanGuess(
                            previousKnowledge,
                            letter,
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

                        knowledge =
                            rejectHangmanCandidate(
                                knowledge,
                                answer.word,
                            );

                        this.activityLogger.hangmanRetryAfterWrongGuess(
                            answer.word,
                            applied.evidence,
                            knowledge,
                        );

                        // Do not waste more guesses on a candidate that has
                        // already been disproved by ClassHero.
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
                    // All new letters from the candidate were tried without a
                    // loss, but the puzzle is still incomplete. The exact word
                    // was therefore still not proven; ask for another hypothesis
                    // using the newly-revealed mask.
                    knowledge =
                        rejectHangmanCandidate(
                            knowledge,
                            answer.word,
                        );

                    this.activityLogger.hangmanCandidateExhausted(
                        answer.word,
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
                    },
                );
            }

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
        status: "failed",
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
