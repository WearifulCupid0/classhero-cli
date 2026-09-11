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
} from "./HangmanKnowledge.js";
import {
    calculateHangmanXpPreview,
} from "./HangmanScoring.js";

const MAX_AI_ROUNDS = 8;

/** AI-backed hangman executor for material and mission-bonus scopes. */
export class HangmanExecutor {
    constructor(
        private readonly api: ClassHero,
        private readonly timing: ExecutionTimingPolicy,
        private readonly activityLogger: AutomationActivityLogger,
    ) {}

    execute(
        context: ActivityContext,
        mode: GameMode,
        provider: AIProvider,
    ): Promise<AutomationExecutionResult> {
        return this.executeScope(
            materialGameScope(context),
            mode,
            provider,
        );
    }

    /** Executes the mission-level bonus hangman after AI preflight. */
    executeMission(
        mission: MissionAutomationContext,
        provider: AIProvider,
        mode: GameMode = "desafio",
    ): Promise<AutomationExecutionResult> {
        return this.executeScope(
            missionGameScope(mission),
            mode,
            provider,
        );
    }

    private async executeScope(
        scope: GameExecutionScope,
        mode: GameMode,
        provider: AIProvider,
    ): Promise<AutomationExecutionResult> {
        try {
            const response = await this.api.games.hangman.puzzle(
                gameStartPayload(scope, mode),
            );

            if (!response.ok) {
                return failed(
                    `Falha ao preparar a forca (HTTP ${response.status}).`,
                    { scope: scope.kind },
                );
            }

            const puzzle = response.response.puzzle;
            this.activityLogger.hangmanStarted(puzzle, mode);

            const timingStartedAt = Date.now();
            let backendState = createInitialBackendState(puzzle);
            let knowledge = createInitialHangmanKnowledge(puzzle);
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

                const generated = await provider.generate(
                    createHangmanProviderRequest(
                        scope,
                        puzzle,
                        knowledge,
                    ),
                );

                const answer = parseHangmanAIAnswer(generated.data);

                if (!answer) {
                    return failed(
                        `O provider '${provider.name}' não retornou uma resposta estruturada válida para a forca.`,
                        {
                            scope: scope.kind,
                            providerId: provider.id,
                            aiRounds,
                        },
                    );
                }

                const normalizedCandidate = normalizeCandidateWord(answer.word);

                this.activityLogger.hangmanAiAnswer(
                    answer.word,
                    normalizedCandidate,
                    provider.name,
                );

                const candidateValidation = validateHangmanCandidate(
                    normalizedCandidate,
                    puzzle,
                    knowledge,
                );

                if (!candidateValidation.valid) {
                    const detail = candidateValidation.reason ??
                        "a candidata contradiz as evidências atuais";

                    knowledge = recordHangmanCandidateFailure(
                        knowledge,
                        {
                            candidate: normalizedCandidate,
                            reason: "local-validation",
                            detail,
                            rejectedLetters: [],
                            maskBefore: knowledge.mask,
                            maskAfter: knowledge.mask,
                            wrongCountBefore: knowledge.wrongCount,
                            wrongCountAfter: knowledge.wrongCount,
                        },
                    );

                    this.activityLogger.hangmanCandidateRejected(
                        normalizedCandidate || answer.word,
                        detail,
                    );
                    continue;
                }

                const candidate = candidateValidation.normalizedCandidate;
                const letters = candidateLettersToTry(candidate, knowledge);

                if (letters.length === 0) {
                    const detail =
                        "a palavra não trouxe nenhuma letra A-Z nova para testar";

                    knowledge = recordHangmanCandidateFailure(
                        knowledge,
                        {
                            candidate,
                            reason: "local-validation",
                            detail,
                            rejectedLetters: [],
                            maskBefore: knowledge.mask,
                            maskAfter: knowledge.mask,
                            wrongCountBefore: knowledge.wrongCount,
                            wrongCountAfter: knowledge.wrongCount,
                        },
                    );

                    this.activityLogger.hangmanCandidateRejected(candidate, detail);
                    continue;
                }

                const candidateMaskBefore = knowledge.mask;
                const candidateWrongCountBefore = knowledge.wrongCount;
                const plannedTotalGuesses =
                    knowledge.guessHistory.length + letters.length;

                const schedule = await this.timing.getGameProgressSchedule({
                    targetId: "hangman",
                    mode,
                    totalUnits: plannedTotalGuesses,
                });

                this.activityLogger.hangmanCandidatePacingPlanned({
                    candidate,
                    mode,
                    gameMinimumSeconds: schedule.gameMinimumSeconds,
                    alreadySent: knowledge.guessHistory.length,
                    pendingLetters: letters,
                    plannedTotalGuesses: schedule.totalUnits,
                    intervalSeconds: schedule.intervalSeconds,
                    enabled: schedule.enabled,
                });

                let candidateProvenWrong = false;

                for (const letter of letters) {
                    const outboundLetter = normalizeHangmanLetter(letter);

                    if (!isAsciiHangmanLetter(outboundLetter)) {
                        return failed(
                            `A letra '${letter}' foi bloqueada porque não pode ser normalizada para A-Z.`,
                            { scope: scope.kind },
                        );
                    }

                    const completedUnits = knowledge.guessHistory.length + 1;
                    const checkpoint = await this.timing.waitForGameProgress({
                        targetId: "hangman",
                        mode,
                        startedAt: timingStartedAt,
                        completedUnits,
                        totalUnits: plannedTotalGuesses,
                    });

                    this.activityLogger.hangmanGuessValidationStarting(
                        outboundLetter,
                        candidate,
                        completedUnits,
                        plannedTotalGuesses,
                        checkpoint.checkpointSeconds,
                    );

                    const previousKnowledge = knowledge;
                    const guessed = await this.api.games.hangman.guess(
                        outboundLetter,
                        puzzle.puzzle_id,
                    );

                    if (!guessed.ok) {
                        return failed(
                            `Falha ao validar a letra '${outboundLetter}' na forca (HTTP ${guessed.status}).`,
                            { scope: scope.kind },
                        );
                    }

                    backendState = guessed.response;
                    const applied = applyHangmanGuess(
                        previousKnowledge,
                        outboundLetter,
                        backendState,
                    );
                    knowledge = applied.knowledge;

                    this.activityLogger.hangmanGuess(
                        applied.evidence,
                        backendState,
                    );

                    if (backendState.won || backendState.lost) {
                        break;
                    }

                    if (applied.evidence.outcome === "wrong") {
                        candidateProvenWrong = true;
                        const detail =
                            `A palavra '${candidate}' está incorreta porque a letra ` +
                            `'${applied.evidence.letter}' foi rejeitada pelo ClassHero: ` +
                            `wrongCount ${applied.evidence.wrongCountBefore} -> ` +
                            `${applied.evidence.wrongCountAfter}. Máscara atual: ` +
                            `${applied.evidence.maskAfter}.`;

                        knowledge = recordHangmanCandidateFailure(
                            knowledge,
                            {
                                candidate,
                                reason: "backend-wrong-letter",
                                detail,
                                rejectedLetters: [applied.evidence.letter],
                                maskBefore: candidateMaskBefore,
                                maskAfter: knowledge.mask,
                                wrongCountBefore: candidateWrongCountBefore,
                                wrongCountAfter: knowledge.wrongCount,
                            },
                        );

                        this.activityLogger.hangmanRetryAfterWrongGuess(
                            candidate,
                            applied.evidence,
                            knowledge,
                        );
                        break;
                    }
                }

                if (backendState.won || backendState.lost) {
                    break;
                }

                if (!candidateProvenWrong) {
                    const detail =
                        `A candidata '${candidate}' não concluiu a palavra mesmo ` +
                        `após testar todas as suas letras novas. A máscara atual é ` +
                        `'${knowledge.mask}'.`;

                    knowledge = recordHangmanCandidateFailure(
                        knowledge,
                        {
                            candidate,
                            reason: "did-not-complete",
                            detail,
                            rejectedLetters: [],
                            maskBefore: candidateMaskBefore,
                            maskAfter: knowledge.mask,
                            wrongCountBefore: candidateWrongCountBefore,
                            wrongCountAfter: knowledge.wrongCount,
                        },
                    );

                    this.activityLogger.hangmanCandidateExhausted(
                        candidate,
                        knowledge,
                    );
                }
            }

            if (!backendState.won && !backendState.lost) {
                return failed(
                    "A IA não conseguiu concluir a forca dentro do limite de novas análises; o resultado não foi submetido.",
                    {
                        scope: scope.kind,
                        providerId: provider.id,
                        aiRounds,
                        mask: knowledge.mask,
                        guessed: knowledge.guessedLetters,
                        correctLetters: knowledge.correctLetters,
                        wrongLetters: knowledge.wrongLetters,
                        wrongCount: knowledge.wrongCount,
                        attemptsLeft: knowledge.attemptsLeft,
                        rejectedCandidates: knowledge.rejectedCandidates,
                        candidateFailures: knowledge.candidateFailures,
                    },
                );
            }

            const timing = await this.timing.waitForGame({
                targetId: "hangman",
                mode,
                startedAt: timingStartedAt,
            });

            const preview = calculateHangmanXpPreview(
                mode,
                backendState.wrongCount,
                0,
                0,
            );

            const submitted = await this.api.games.hangman.submit({
                puzzleId: puzzle.puzzle_id,
                won: backendState.won,
                attempts: backendState.wrongCount,
                ...(scope.kind === "material"
                    ? { materialId: scope.materialId }
                    : {}),
                missionId: scope.missionId,
                context: scope.kind,
                mode,
                hintsUsed: 0,
                time_seconds: Math.max(1, Math.ceil(timing.totalElapsedSeconds)),
                bonusApplied:
                    mode === "desafio" && preview.multiplierApplied,
                xpPreview: preview.finalXp,
                ...(response.response.content_id === undefined
                    ? {}
                    : { content_id: response.response.content_id }),
                clientGameStatus: "running",
            });

            if (!submitted.ok) {
                return failed(
                    `Falha ao enviar o resultado da forca (HTTP ${submitted.status}).`,
                    { scope: scope.kind },
                );
            }

            this.activityLogger.hangmanFinished(
                submitted.response,
                provider.name,
            );

            return {
                status: "completed",
                targetId: "hangman",
                strategy: "ai",
                message: submitted.response.message || "Forca concluída.",
                details: {
                    scope: scope.kind,
                    providerId: provider.id,
                    providerName: provider.name,
                    aiRounds,
                    won: submitted.response.won,
                    revealedWord: submitted.response.revealed_word,
                    wrongCount: backendState.wrongCount,
                    correctLetters: knowledge.correctLetters,
                    wrongLetters: knowledge.wrongLetters,
                    rejectedCandidates: knowledge.rejectedCandidates,
                    candidateFailures: knowledge.candidateFailures,
                    score: submitted.response.score,
                    xpAwarded: submitted.response.xp_awarded,
                    xpPreview: preview.finalXp,
                    timingEnabled: timing.enabled,
                    minimumSeconds: timing.minimumSeconds,
                    waitedSeconds: timing.waitedSeconds,
                    totalElapsedSeconds: timing.totalElapsedSeconds,
                },
            };
        } catch (error) {
            return failed(
                error instanceof Error ? error.message : String(error),
                { scope: scope.kind },
            );
        }
    }
}

function createInitialBackendState(
    puzzle: HangmanPuzzle,
): HangmanGuessResponse {
    return {
        puzzle_id: puzzle.puzzle_id,
        hint: puzzle.hint,
        mask: puzzle.mask,
        guessed: [],
        wrongCount: 0,
        attemptsLeft: 6,
        won: false,
        lost: false,
    };
}

function failed(
    message: string,
    details?: Readonly<Record<string, unknown>>,
): AutomationExecutionResult {
    return {
        status: "failed",
        targetId: "hangman",
        strategy: "ai",
        message,
        ...(details === undefined ? {} : { details }),
    };
}
