import { randomUUID } from "node:crypto";
import type {
    ActiveQuizAttemptResponse,
    ClassHero,
    QuizLevel,
} from "@classhero-cli/api-wrapper";
import type {
    ActivityContext,
    AutomationExecutionResult,
} from "../contracts/activity.js";
import {
    getSourceMissionMaterialId,
    requireActivityTarget,
} from "../context/ActivityTargets.js";
import type {
    AutomationActivityLogger,
} from "../logging/AutomationActivityLogger.js";
import {
    createQuizProviderRequest,
    parseQuizAIAnswer,
} from "../prompts/QuizPrompt.js";
import {
    getDefaultQuizLevel,
    getDefaultQuizQuestionCount,
} from "../quiz/QuizMaterialConfig.js";
import type {
    AIProvider,
} from "../providers/contracts.js";
import type {
    ExecutionTimingPolicy,
} from "../timing/ExecutionTimingPolicy.js";
import {
    normalizeQuizAnswer,
} from "./QuizAnswerNormalizer.js";

export interface QuizExecutionOptions {
    readonly level?: QuizLevel;
    readonly quantity?: number;
    readonly themeMissionMaterialId?: string;
}

interface ResolvedAttempt {
    readonly attemptId: string;
    readonly startedAt: string;
    readonly questionIds: readonly string[];
    readonly level: QuizLevel;
    readonly themeMissionMaterialId: string;
    readonly resumed: boolean;
}

/**
 * AI-backed ClassHero quiz executor synchronized with the complete browser HAR.
 */
export class QuizExecutor {
    constructor(
        private readonly api: ClassHero,
        private readonly timing: ExecutionTimingPolicy,
        private readonly activityLogger: AutomationActivityLogger,
    ) {}

    async execute(
        context: ActivityContext,
        provider: AIProvider,
        options: QuizExecutionOptions = {},
    ): Promise<AutomationExecutionResult> {
        try {
            const resolved =
                await this.resolveAttempt(
                    context,
                    options,
                );

            if (
                "result" in resolved
            ) {
                return resolved.result;
            }

            const attempt =
                resolved.attempt;

            /*
             * The captured web client reuses one trace id across every
             * update/validate pair in the same attempt flow.
             */
            const traceId =
                randomUUID();

            this.activityLogger.quizStarted(
                attempt.attemptId,
                attempt.level,
                attempt.questionIds.length,
                provider.name,
                attempt.resumed,
            );

            let answered = 0;
            let correct = 0;
            let totalQuestionXp = 0;

            for (
                let index = 0;
                index <
                    attempt.questionIds.length;
                index++
            ) {
                const questionId =
                    attempt.questionIds[
                        index
                    ];

                if (!questionId) {
                    continue;
                }

                const questionStartedAt =
                    Date.now();

                const questionResponse =
                    await this.api.quizzes.questionJson(
                        attempt.attemptId,
                        questionId,
                    );

                if (!questionResponse.ok) {
                    return failed(
                        `Falha ao carregar a pergunta ${index + 1}/${attempt.questionIds.length} (HTTP ${questionResponse.status}).`,
                        {
                            attemptId:
                                attempt.attemptId,
                            questionId,
                            answered,
                        },
                    );
                }

                /*
                 * HAR order: question JSON -> attempt last_access_at -> answer
                 * update -> validation.
                 */
                const access =
                    await this.api.quizzes.updateAttempt(
                        attempt.attemptId,
                        {
                            last_access_at:
                                new Date().toISOString(),
                        },
                    );

                if (!access.ok) {
                    return failed(
                        `Falha ao registrar acesso à pergunta ${index + 1}/${attempt.questionIds.length} (HTTP ${access.status}).`,
                        {
                            attemptId:
                                attempt.attemptId,
                            questionId,
                            answered,
                        },
                    );
                }

                const question =
                    questionResponse.response
                        .question_json;

                this.activityLogger.quizQuestion(
                    question,
                    index + 1,
                    attempt.questionIds.length,
                );

                const generation =
                    await provider.generate(
                        createQuizProviderRequest(
                            context,
                            question,
                        ),
                    );

                const aiAnswer =
                    parseQuizAIAnswer(
                        generation.data,
                    );

                if (!aiAnswer) {
                    return failed(
                        `O provider '${provider.name}' não retornou uma resposta estruturada válida para a pergunta ${index + 1}.`,
                        {
                            attemptId:
                                attempt.attemptId,
                            questionId,
                            answered,
                        },
                    );
                }

                this.activityLogger.quizAiAnswer(
                    question,
                    aiAnswer.answers,
                    provider.name,
                    index + 1,
                    attempt.questionIds.length,
                );

                const normalized =
                    normalizeQuizAnswer(
                        question,
                        aiAnswer.answers,
                    );

                if (!normalized.ok) {
                    this.activityLogger.quizAnswerRejected(
                        question,
                        normalized.reason,
                        index + 1,
                        attempt.questionIds.length,
                    );

                    return failed(
                        `A resposta da IA foi bloqueada antes do envio: ${normalized.reason}.`,
                        {
                            attemptId:
                                attempt.attemptId,
                            questionId,
                            questionType:
                                question.type,
                            answered,
                        },
                    );
                }

                const timing =
                    await this.timing.waitForQuizQuestion(
                        questionStartedAt,
                    );

                const answeredAt =
                    new Date().toISOString();

                const durationSeconds =
                    Math.max(
                        1,
                        Math.ceil(
                            timing.totalElapsedSeconds,
                        ),
                    );

                this.activityLogger.quizAnswerSubmitting(
                    question,
                    normalized.answers,
                    index + 1,
                    attempt.questionIds.length,
                );

                const updated =
                    await this.api.quizzes.updateAttemptQuestion(
                        {
                            attempt_id:
                                attempt.attemptId,
                            question_id:
                                question.question_id,
                            status:
                                "answered",
                            is_answered:
                                true,
                            answer: [
                                ...normalized.answers,
                            ],
                            answered_at:
                                answeredAt,
                            question_duration_seconds:
                                durationSeconds,
                            /*
                             * Observed constant across every question in the
                             * attempt. This is NOT the per-question start.
                             */
                            started_at:
                                attempt.startedAt,
                        },
                        traceId,
                    );

                if (!updated.ok) {
                    return failed(
                        `Falha ao enviar a resposta da pergunta ${index + 1}/${attempt.questionIds.length} (HTTP ${updated.status}).`,
                        {
                            attemptId:
                                attempt.attemptId,
                            questionId:
                                question.question_id,
                            answered,
                        },
                    );
                }

                const validation =
                    await this.api.quizzes.validateAttemptQuestion(
                        {
                            attempt_id:
                                attempt.attemptId,
                            question_id:
                                question.question_id,
                        },
                        traceId,
                    );

                if (!validation.ok) {
                    return failed(
                        `A resposta foi enviada, mas a validação da pergunta ${index + 1} falhou (HTTP ${validation.status}).`,
                        {
                            attemptId:
                                attempt.attemptId,
                            questionId:
                                question.question_id,
                            answered:
                                answered + 1,
                        },
                    );
                }

                answered++;

                this.activityLogger.quizAnswerValidated(
                    question,
                    validation.response,
                    index + 1,
                    attempt.questionIds.length,
                    timing,
                );

                if (
                    validation.response
                        .technicalFailure
                ) {
                    return failed(
                        `O ClassHero informou falha técnica ao avaliar a pergunta ${index + 1}; a execução foi interrompida.`,
                        {
                            attemptId:
                                attempt.attemptId,
                            questionId:
                                question.question_id,
                            answered,
                            evaluationStatus:
                                validation.response
                                    .evaluationStatus,
                        },
                    );
                }

                if (
                    validation.response
                        .isCorrect === true
                ) {
                    correct++;
                }

                totalQuestionXp +=
                    numericQuestionXp(
                        validation.response,
                    );
            }

            const score =
                await this.api.quizzes.score(
                    attempt.attemptId,
                );

            if (!score.ok) {
                return failed(
                    `Todas as perguntas foram processadas, mas não foi possível obter a pontuação final (HTTP ${score.status}).`,
                    {
                        attemptId:
                            attempt.attemptId,
                        answered,
                    },
                );
            }

            this.activityLogger.quizFinished(
                attempt.attemptId,
                score.response,
                answered,
                provider.name,
            );

            return {
                status:
                    "completed",
                targetId:
                    "quiz",
                strategy:
                    "ai",
                message:
                    `Quiz concluído: ${answered} pergunta(s) processada(s).`,
                details: {
                    providerId:
                        provider.id,
                    providerName:
                        provider.name,
                    attemptId:
                        attempt.attemptId,
                    resumed:
                        attempt.resumed,
                    level:
                        attempt.level,
                    answered,
                    correctWhenReported:
                        correct,
                    questionXpReported:
                        totalQuestionXp,
                    score:
                        score.response.score,
                    finalScore:
                        score.response.final_score,
                    scoreCorrect:
                        score.response.score_correct,
                    scoreAverageTime:
                        score.response.score_avg_time,
                    scoreTotalTime:
                        score.response.score_total_time,
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

    private async resolveAttempt(
        context: ActivityContext,
        options: QuizExecutionOptions,
    ): Promise<
        | {
            readonly attempt:
                ResolvedAttempt;
        }
        | {
            readonly result:
                AutomationExecutionResult;
        }
    > {
        const quizTarget =
            requireActivityTarget(context, "quiz");

        const active =
            await this.api.quizzes.activeAttempt(
                quizTarget.materialId,
                {
                    all_available:
                        true,
                },
            );

        if (
            active.ok &&
            active.response.attempt &&
            active.response
                .pending_questions
                .length > 0
        ) {
            return {
                attempt:
                    fromActiveAttempt(
                        active.response,
                    ),
            };
        }

        const level =
            options.level ??
            getDefaultQuizLevel(
                context,
            );

        const quantity =
            normalizeQuantity(
                options.quantity ??
                    getDefaultQuizQuestionCount(
                        context,
                        level,
                    ),
            );

        const sourceId =
            options.themeMissionMaterialId ??
            getSourceMissionMaterialId(context);

        if (!sourceId) {
            return {
                result: {
                    status:
                        "blocked",
                    targetId:
                        "quiz",
                    strategy:
                        "ai",
                    message:
                        "Nenhuma tentativa ativa foi encontrada e é necessário selecionar o material-fonte do quiz antes de iniciar uma nova tentativa.",
                },
            };
        }

        const started =
            await this.api.quizzes.startAttempt({
                material_id:
                    quizTarget.materialId,
                theme_id:
                    context.themeId,
                theme_mission_material_id:
                    sourceId,
                level,
                all_available:
                    "true",
                quantity:
                    String(
                        quantity,
                    ),
            });

        if (!started.ok) {
            return {
                result:
                    failed(
                        `Falha ao iniciar o quiz (HTTP ${started.status}).`,
                    ),
            };
        }

        const questionIds =
            [
                ...started.response
                    .questions,
            ]
                .sort(
                    (left, right) =>
                        (
                            left.order ??
                            left.order_index ??
                            0
                        ) -
                        (
                            right.order ??
                            right.order_index ??
                            0
                        ),
                )
                .map(
                    (question) =>
                        question.question_id,
                )
                .filter(Boolean);

        if (
            questionIds.length === 0
        ) {
            return {
                result:
                    failed(
                        "O ClassHero criou a tentativa, mas não retornou perguntas para responder.",
                        {
                            attemptId:
                                started.response
                                    .attempt_id,
                        },
                    ),
            };
        }

        return {
            attempt: {
                attemptId:
                    started.response
                        .attempt_id,
                startedAt:
                    started.response
                        .started_at,
                questionIds,
                level,
                themeMissionMaterialId:
                    sourceId,
                resumed:
                    false,
            },
        };
    }
}

function fromActiveAttempt(
    active: ActiveQuizAttemptResponse,
): ResolvedAttempt {
    const attempt =
        active.attempt!;

    const questionIds = [
        ...active.pending_questions,
    ]
        .sort(
            (left, right) =>
                left.order_index -
                right.order_index,
        )
        .map(
            (question) =>
                question.question_id,
        );

    return {
        attemptId:
            attempt.quiz_attempt_id,
        startedAt:
            attempt.started_at,
        questionIds,
        level:
            attempt.level,
        themeMissionMaterialId:
            attempt.theme_mission_material_id,
        resumed:
            true,
    };
}

function normalizeQuantity(
    value: number,
): number {
    if (
        !Number.isFinite(value)
    ) {
        return 10;
    }

    return Math.max(
        1,
        Math.floor(
            value,
        ),
    );
}

function numericQuestionXp(
    response: {
        readonly questionXp?: number;
        readonly question_xp?: number;
    },
): number {
    const value =
        response.questionXp ??
        response.question_xp ??
        0;

    return Number.isFinite(value)
        ? Math.max(
            0,
            value,
        )
        : 0;
}

function failed(
    message: string,
    details?: Readonly<Record<string, unknown>>,
): AutomationExecutionResult {
    return {
        status:
            "failed",
        targetId:
            "quiz",
        strategy:
            "ai",
        message,
        ...(details === undefined
            ? {}
            : { details }),
    };
}
