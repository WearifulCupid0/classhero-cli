import type {
    ClassHero,
    GameMode,
    QuizLevel,
} from "@classhero-cli/api-wrapper";
import type {
    ActivityContext,
    AutomationExecutionResult,
    AutomationPlan,
    AutomationTargetId,
} from "../contracts/activity.js";
import { HangmanExecutor } from "../executors/HangmanExecutor.js";
import { InteractivePathExecutor } from "../executors/InteractivePathExecutor.js";
import { MemoryExecutor } from "../executors/MemoryExecutor.js";
import {
    QuizExecutor,
    type QuizExecutionOptions,
} from "../executors/QuizExecutor.js";
import { WordSearchExecutor } from "../executors/WordSearchExecutor.js";
import type { AutomationActivityLogger } from "../logging/AutomationActivityLogger.js";
import { AutomationPlanner } from "../planner/AutomationPlanner.js";
import type {
    AIProvider,
    AIProviderCapability,
} from "../providers/contracts.js";
import type { ExecutionTimingPolicy } from "../timing/ExecutionTimingPolicy.js";

export interface ExecuteAutomationOptions {
    readonly mode?: GameMode;
    readonly providerId?: string;
    readonly quizLevel?: QuizLevel;
    readonly quizQuantity?: number;
    readonly themeMissionMaterialId?: string;
    /** Level for a `gamified_interactive_path`; question quantity is path-owned. */
    readonly interactivePathLevel?: string;
}

export class AutomationEngine {
    private readonly wordSearch: WordSearchExecutor;
    private readonly memory: MemoryExecutor;
    private readonly hangman: HangmanExecutor;
    private readonly quiz: QuizExecutor;
    private readonly interactivePath: InteractivePathExecutor;

    constructor(
        api: ClassHero,
        private readonly providerResolver: () => readonly AIProvider[],
        private readonly timingPolicy: ExecutionTimingPolicy,
        private readonly activityLogger: AutomationActivityLogger,
        private readonly planner = new AutomationPlanner(),
    ) {
        this.wordSearch = new WordSearchExecutor(api, timingPolicy, activityLogger);
        this.memory = new MemoryExecutor(api, timingPolicy, activityLogger);
        this.hangman = new HangmanExecutor(api, timingPolicy, activityLogger);
        this.quiz = new QuizExecutor(api, timingPolicy, activityLogger);
        this.interactivePath = new InteractivePathExecutor(
            api,
            timingPolicy,
            activityLogger,
        );
    }

    inspect(context: ActivityContext): AutomationPlan {
        return this.planner.plan(context);
    }

    providers(): readonly AIProvider[] {
        return this.providerResolver();
    }

    timing(): ExecutionTimingPolicy {
        return this.timingPolicy;
    }

    logging(): AutomationActivityLogger {
        return this.activityLogger;
    }

    async execute(
        context: ActivityContext,
        targetId: AutomationTargetId,
        options: ExecuteAutomationOptions = {},
    ): Promise<AutomationExecutionResult> {
        switch (targetId) {
            case "word-search":
                return this.wordSearch.execute(context, options.mode ?? "desafio");

            case "memory":
                return this.memory.execute(context, options.mode ?? "desafio");

            case "hangman": {
                const provider = await this.resolveProvider(
                    "hangman",
                    options.providerId,
                );
                if (!provider) {
                    return providerBlocked("hangman", "hangman");
                }
                return this.hangman.execute(
                    context,
                    options.mode ?? "desafio",
                    provider,
                );
            }

            case "quiz": {
                const provider = await this.resolveProvider(
                    "quiz",
                    options.providerId,
                );
                if (!provider) {
                    return providerBlocked("quiz", "quiz");
                }

                const quizOptions: QuizExecutionOptions = {
                    ...(options.quizLevel === undefined
                        ? {}
                        : { level: options.quizLevel }),
                    ...(options.quizQuantity === undefined
                        ? {}
                        : { quantity: options.quizQuantity }),
                    ...(options.themeMissionMaterialId === undefined
                        ? {}
                        : {
                            themeMissionMaterialId:
                                options.themeMissionMaterialId,
                        }),
                };

                return this.quiz.execute(context, provider, quizOptions);
            }

            case "interactive-path": {
                /*
                 * Provider is optional at this point: a Trilha may contain
                 * only theory_card/checkpoint steps. The executor blocks only
                 * if it actually encounters a quick_quiz without a provider.
                 */
                const provider = await this.resolveProvider(
                    "interactive-path",
                    options.providerId,
                );

                return this.interactivePath.execute(
                    context,
                    {
                        level: options.interactivePathLevel ?? "basic",
                    },
                    provider,
                );
            }

            case "code":
                return this.aiBlocked(
                    targetId,
                    "code",
                    options.providerId,
                );

            case "discursive":
                return this.aiBlocked(
                    targetId,
                    "discursive",
                    options.providerId,
                );
        }
    }

    private async aiBlocked(
        targetId: AutomationTargetId,
        capability: AIProviderCapability,
        preferredProviderId?: string,
    ): Promise<AutomationExecutionResult> {
        const provider = await this.resolveProvider(
            capability,
            preferredProviderId,
        );

        if (!provider) {
            return providerBlocked(targetId, capability);
        }

        return {
            status: "unsupported",
            targetId,
            strategy: "ai",
            message: `O provider '${provider.name}' está conectado, mas o executor específico de '${targetId}' ainda não foi implementado.`,
            details: {
                providerId: provider.id,
                providerName: provider.name,
            },
        };
    }

    private async resolveProvider(
        capability: AIProviderCapability,
        preferredProviderId?: string,
    ): Promise<AIProvider | undefined> {
        const candidates = this.providers().filter(
            (provider) =>
                provider.capabilities.includes(capability) &&
                (preferredProviderId === undefined ||
                    provider.id === preferredProviderId),
        );

        for (const provider of candidates) {
            if (!provider.isAvailable || (await provider.isAvailable())) {
                return provider;
            }
        }

        return undefined;
    }
}

function providerBlocked(
    targetId: AutomationTargetId,
    capability: AIProviderCapability,
): AutomationExecutionResult {
    return {
        status: "blocked",
        targetId,
        strategy: "ai",
        message: `A atividade exige IA, mas nenhum AI Provider compatível com '${capability}' está disponível.`,
    };
}
