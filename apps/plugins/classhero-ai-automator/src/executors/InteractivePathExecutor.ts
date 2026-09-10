import type {
    ClassHero,
    GamifiedInteractivePath,
    GamifiedInteractivePathStep,
    SubmitGamifiedInteractivePathStepInput,
} from "@classhero-cli/api-wrapper";
import { requireActivityTarget } from "../context/ActivityTargets.js";
import type {
    ActivityContext,
    AutomationExecutionResult,
} from "../contracts/activity.js";
import type { AutomationActivityLogger } from "../logging/AutomationActivityLogger.js";
import {
    createInteractivePathProviderRequest,
    parseInteractivePathAIAnswer,
} from "../prompts/InteractivePathPrompt.js";
import type { AIProvider } from "../providers/contracts.js";
import type { ExecutionTimingPolicy } from "../timing/ExecutionTimingPolicy.js";

export interface InteractivePathExecutionOptions {
    readonly level: string;
}

/**
 * Executes a ClassHero `gamified_interactive_path` ("Trilha").
 *
 * Theory/checkpoint steps are deterministic acknowledgements and do not use
 * AI. Only `quick_quiz` steps require an AI provider.
 */
export class InteractivePathExecutor {
    constructor(
        private readonly api: ClassHero,
        private readonly timing: ExecutionTimingPolicy,
        private readonly activityLogger: AutomationActivityLogger,
    ) {}

    async execute(
        context: ActivityContext,
        options: InteractivePathExecutionOptions,
        provider?: AIProvider,
    ): Promise<AutomationExecutionResult> {
        try {
            const target = requireActivityTarget(context, "interactive-path");
            const started = await this.api.themeMaterials.startGamifiedInteractivePath({
                material_id: target.materialId,
                level_key: options.level,
                mode: "attempt",
            });

            if (!started.ok) {
                return failed(
                    `Falha ao iniciar a Trilha (HTTP ${started.status}).`,
                );
            }

            const session = started.response;
            const { attempt, path } = session;

            this.activityLogger.interactivePathStarted(
                path,
                attempt,
                provider?.name,
                session.resumed_attempt,
            );

            if (session.review_mode && attempt.status === "completed") {
                return {
                    status: "completed",
                    targetId: "interactive-path",
                    strategy: "ai",
                    message: "A Trilha já está concluída e foi aberta em modo de revisão.",
                    details: {
                        attemptId: attempt.attempt_id,
                        level: attempt.level_key,
                        reviewMode: true,
                        totalXpAwarded: attempt.total_xp_awarded,
                    },
                };
            }

            const resolvedStepIds = new Set(
                session.step_attempts.map((item) => item.step_id),
            );
            const steps = [...path.steps].sort(
                (left, right) => left.position - right.position,
            );

            let processed = 0;
            let lastCompletedLesson = false;

            for (let index = 0; index < steps.length; index++) {
                const step = steps[index]!;

                if (resolvedStepIds.has(step.step_id)) {
                    this.activityLogger.interactivePathStepSkipped(
                        step,
                        index + 1,
                        steps.length,
                    );
                    continue;
                }

                const stepStartedAt = Date.now();
                const submission = await this.buildStepSubmission(
                    context,
                    path,
                    attempt.attempt_id,
                    step,
                    index + 1,
                    steps.length,
                    provider,
                    stepStartedAt,
                );

                if ("result" in submission) {
                    return submission.result;
                }

                const response =
                    await this.api.themeMaterials.submitGamifiedInteractivePathStep(
                        submission.input,
                    );

                if (!response.ok) {
                    return failed(
                        `Falha ao enviar o passo ${index + 1}/${steps.length} da Trilha (HTTP ${response.status}).`,
                        {
                            attemptId: attempt.attempt_id,
                            stepId: step.step_id,
                            stepType: step.step_type,
                        },
                    );
                }

                processed++;
                lastCompletedLesson = response.response.completed_lesson;

                this.activityLogger.interactivePathStepResult(
                    step,
                    response.response,
                    index + 1,
                    steps.length,
                    submission.timingSeconds,
                );
            }

            const completed =
                await this.api.themeMaterials.completeGamifiedInteractivePathAttempt(
                    attempt.attempt_id,
                );

            if (!completed.ok) {
                return failed(
                    `Os passos da Trilha foram processados, mas a finalização falhou (HTTP ${completed.status}).`,
                    {
                        attemptId: attempt.attempt_id,
                        processed,
                        completedLesson: lastCompletedLesson,
                    },
                );
            }

            this.activityLogger.interactivePathFinished(completed.response);

            return {
                status: "completed",
                targetId: "interactive-path",
                strategy: "ai",
                message: "Trilha concluída.",
                details: {
                    providerId: provider?.id,
                    providerName: provider?.name,
                    attemptId: completed.response.attempt_id,
                    level: completed.response.level_key,
                    processedSteps: processed,
                    totalSteps: completed.response.total_steps,
                    correctSteps: completed.response.correct_steps,
                    wrongSteps: completed.response.wrong_steps,
                    totalXpAwarded: completed.response.total_xp_awarded,
                    completionBonus: completed.response.completion_bonus,
                    alreadyCompleted: completed.response.already_completed,
                },
            };
        } catch (error) {
            return failed(error instanceof Error ? error.message : String(error));
        }
    }

    private async buildStepSubmission(
        context: ActivityContext,
        path: GamifiedInteractivePath,
        attemptId: string,
        step: GamifiedInteractivePathStep,
        index: number,
        total: number,
        provider: AIProvider | undefined,
        stepStartedAt: number,
    ): Promise<
        | {
            readonly input: SubmitGamifiedInteractivePathStepInput;
            readonly timingSeconds?: number;
        }
        | { readonly result: AutomationExecutionResult }
    > {
        switch (step.step_type) {
            case "theory_card":
            case "checkpoint":
                this.activityLogger.interactivePathAcknowledgement(
                    step,
                    index,
                    total,
                );
                return {
                    input: {
                        attempt_id: attemptId,
                        step_id: step.step_id,
                        answer_payload: { acknowledged: true },
                        hints_used: 0,
                    },
                };

            case "quick_quiz": {
                if (!provider) {
                    return {
                        result: {
                            status: "blocked",
                            targetId: "interactive-path",
                            strategy: "ai",
                            message:
                                "A Trilha possui um quick_quiz, mas nenhum AI Provider compatível com 'interactive-path' está disponível.",
                            details: {
                                stepId: step.step_id,
                                position: step.position,
                            },
                        },
                    };
                }

                const options = step.payload.options ?? [];
                if (options.length === 0) {
                    return {
                        result: failed(
                            `O passo quick_quiz ${index}/${total} não possui alternativas.`,
                            { stepId: step.step_id },
                        ),
                    };
                }

                this.activityLogger.interactivePathQuestion(
                    step,
                    index,
                    total,
                );

                const generated = await provider.generate(
                    createInteractivePathProviderRequest(context, path, step),
                );
                const answer = parseInteractivePathAIAnswer(generated.data);

                if (!answer) {
                    return {
                        result: failed(
                            `O provider '${provider.name}' não retornou uma resposta estruturada válida para o passo ${index}/${total}.`,
                            { stepId: step.step_id },
                        ),
                    };
                }

                const selected = options.find(
                    (option) =>
                        option.id.toLocaleLowerCase("pt-BR") ===
                        answer.selectedOptionId.toLocaleLowerCase("pt-BR"),
                );

                if (!selected) {
                    return {
                        result: failed(
                            `A IA selecionou '${answer.selectedOptionId}', que não corresponde a nenhuma opção do passo ${index}/${total}.`,
                            { stepId: step.step_id },
                        ),
                    };
                }

                this.activityLogger.interactivePathAiAnswer(
                    step,
                    selected,
                    provider.name,
                    index,
                    total,
                );

                const timing =
                    await this.timing.waitForInteractivePathQuestion(
                        stepStartedAt,
                    );

                return {
                    input: {
                        attempt_id: attemptId,
                        step_id: step.step_id,
                        answer_payload: {
                            selected_option_id: selected.id,
                            answer: selected.value,
                        },
                        hints_used: 0,
                    },
                    timingSeconds: timing.totalElapsedSeconds,
                };
            }

            default:
                return {
                    result: {
                        status: "unsupported",
                        targetId: "interactive-path",
                        strategy: "ai",
                        message: `O tipo de passo '${step.step_type}' da Trilha ainda não possui executor seguro.`,
                        details: {
                            stepId: step.step_id,
                            position: step.position,
                        },
                    },
                };
        }
    }
}

function failed(
    message: string,
    details?: Readonly<Record<string, unknown>>,
): AutomationExecutionResult {
    return {
        status: "failed",
        targetId: "interactive-path",
        strategy: "ai",
        message,
        ...(details === undefined ? {} : { details }),
    };
}
