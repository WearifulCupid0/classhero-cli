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
import { AnagramExecutor } from "../executors/AnagramExecutor.js";
import type {
    MissionAutomationContext,
    MissionBonusGameTargetId,
} from "../contracts/mission.js";
import { HangmanExecutor } from "../executors/HangmanExecutor.js";
import { InteractivePathExecutor } from "../executors/InteractivePathExecutor.js";
import { MemoryExecutor } from "../executors/MemoryExecutor.js";
import {
    QuizExecutor,
    type QuizExecutionOptions,
} from "../executors/QuizExecutor.js";
import { WordSearchExecutor } from "../executors/WordSearchExecutor.js";
import {
    GameEligibilityPolicy,
    isRetryControlledGame,
    type GameModeEligibility,
    type RetryControlledGameId,
} from "../games/GameEligibilityPolicy.js";
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

/**
 * Public result of checking whether an automation can start safely.
 *
 * No ClassHero activity/game/session endpoint is called during preflight.
 */
export type AutomationPreflightResult =
    | {
        readonly ready: true;
        readonly targetId: AutomationTargetId;
        readonly requiresAI: false;
    }
    | {
        readonly ready: true;
        readonly targetId: AutomationTargetId;
        readonly requiresAI: true;
        readonly capability: AIProviderCapability;
        readonly providerId: string;
        readonly providerName: string;
    }
    | {
        readonly ready: false;
        readonly targetId: AutomationTargetId;
        readonly requiresAI: true;
        readonly capability: AIProviderCapability;
        readonly message: string;
    };

type ResolvedAutomationPreflight =
    | {
        readonly ready: true;
        readonly targetId: AutomationTargetId;
        readonly requiresAI: false;
    }
    | {
        readonly ready: true;
        readonly targetId: AutomationTargetId;
        readonly requiresAI: true;
        readonly capability: AIProviderCapability;
        readonly provider: AIProvider;
    }
    | {
        readonly ready: false;
        readonly targetId: AutomationTargetId;
        readonly requiresAI: true;
        readonly capability: AIProviderCapability;
        readonly message: string;
    };

/**
 * AI requirements are explicit rather than inferred ad hoc inside executors.
 *
 * `interactive-path` is conservatively preflighted as AI-dependent because the
 * path steps are only known after the attempt is started. This prevents the
 * CLI from creating a Trilha attempt and discovering later that a quick_quiz
 * cannot be answered.
 */
const AI_CAPABILITY_BY_TARGET: Readonly<
    Partial<Record<AutomationTargetId, AIProviderCapability>>
> = {
    hangman: "hangman",
    anagram: "anagram",
    quiz: "quiz",
    "interactive-path": "interactive-path",
    code: "code",
    discursive: "discursive",
};

export class AutomationEngine {
    private readonly wordSearch: WordSearchExecutor;
    private readonly memory: MemoryExecutor;
    private readonly hangman: HangmanExecutor;
    private readonly anagram: AnagramExecutor;
    private readonly quiz: QuizExecutor;
    private readonly interactivePath: InteractivePathExecutor;
    private readonly gameEligibility: GameEligibilityPolicy;

    constructor(
        private readonly api: ClassHero,
        private readonly providerResolver: () => readonly AIProvider[],
        private readonly timingPolicy: ExecutionTimingPolicy,
        private readonly activityLogger: AutomationActivityLogger,
        private readonly planner = new AutomationPlanner(),
    ) {
        this.gameEligibility = new GameEligibilityPolicy(
            api,
        );
        this.wordSearch = new WordSearchExecutor(
            api,
            timingPolicy,
            activityLogger,
        );
        this.memory = new MemoryExecutor(
            api,
            timingPolicy,
            activityLogger,
        );
        this.hangman = new HangmanExecutor(
            api,
            timingPolicy,
            activityLogger,
        );
        this.anagram = new AnagramExecutor(
            api,
            timingPolicy,
        );
        this.quiz = new QuizExecutor(
            api,
            timingPolicy,
            activityLogger,
        );
        this.interactivePath = new InteractivePathExecutor(
            api,
            timingPolicy,
            activityLogger,
        );
    }

    inspect(
        context: ActivityContext,
    ): AutomationPlan {
        return this.planner.plan(
            context,
        );
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

    /**
     * Returns Study/Focus/Challenge availability for one material game.
     * This performs only read requests and is reused by the UI before the
     * player is asked to choose a mode.
     */
    gameModes(
        context: ActivityContext,
        targetId: RetryControlledGameId,
    ): Promise<readonly GameModeEligibility[]> {
        return this.gameEligibility.inspect(
            context,
            targetId,
        );
    }

    /**
     * Resolves a configured AI provider for mission-wide assistant flows.
     *
     * This performs no ClassHero side effect and uses the same fail-closed
     * availability check as normal automation preflight.
     */
    async availableAIProvider(
        capability: AIProviderCapability,
        preferredProviderId?: string,
    ): Promise<AIProvider | undefined> {
        return this.resolveProvider(
            capability,
            preferredProviderId,
        );
    }

    /**
     * Checks every dependency required to start an automation.
     *
     * This performs no ClassHero activity-side effects. In particular it does
     * not create a game puzzle, quiz attempt or interactive-path attempt.
     */
    async preflight(
        targetId: AutomationTargetId,
        preferredProviderId?: string,
    ): Promise<AutomationPreflightResult> {
        const result =
            await this.resolvePreflight(
                targetId,
                preferredProviderId,
            );

        if (!result.ready) {
            return result;
        }

        if (!result.requiresAI) {
            return result;
        }

        return {
            ready: true,
            targetId:
                result.targetId,
            requiresAI: true,
            capability:
                result.capability,
            providerId:
                result.provider.id,
            providerName:
                result.provider.name,
        };
    }

    /**
     * Executes one target after an internal mandatory preflight.
     *
     * The preflight is repeated here intentionally so direct programmatic
     * callers cannot bypass the same safety check used by the interactive UI.
     */
    async execute(
        context: ActivityContext,
        targetId: AutomationTargetId,
        options: ExecuteAutomationOptions = {},
    ): Promise<AutomationExecutionResult> {
        if (isRetryControlledGame(targetId)) {
            const mode =
                options.mode ??
                "desafio";

            const eligibility =
                await this.gameEligibility.check(
                    context,
                    targetId,
                    mode,
                );

            if (!eligibility.allowed) {
                return {
                    status:
                        "blocked",
                    targetId,
                    strategy:
                        targetId === "word-search" ||
                        targetId === "memory"
                            ? "native"
                            : "ai",
                    message:
                        eligibility.reason,
                    details: {
                        mode:
                            eligibility.mode,
                        source:
                            eligibility.source,
                        ...(eligibility.xpEarned === undefined
                            ? {}
                            : { xpEarned: eligibility.xpEarned }),
                        ...(eligibility.completed === undefined
                            ? {}
                            : { completed: eligibility.completed }),
                        ...(eligibility.xpPossible === undefined
                            ? {}
                            : { xpPossible: eligibility.xpPossible }),
                    },
                };
            }
        }

        const preflight =
            await this.resolvePreflight(
                targetId,
                options.providerId,
            );

        if (!preflight.ready) {
            return providerBlocked(
                targetId,
                preflight.capability,
                preflight.message,
            );
        }

        switch (targetId) {
            case "word-search":
                return this.wordSearch.execute(
                    context,
                    options.mode ??
                        "desafio",
                );

            case "memory":
                return this.memory.execute(
                    context,
                    options.mode ??
                        "desafio",
                );

            case "hangman": {
                const provider =
                    requireResolvedProvider(
                        preflight,
                        targetId,
                    );

                return this.hangman.execute(
                    context,
                    options.mode ??
                        "desafio",
                    provider,
                );
            }

            case "anagram": {
                const provider =
                    requireResolvedProvider(
                        preflight,
                        targetId,
                    );

                return this.anagram.execute(
                    context,
                    options.mode ??
                        "desafio",
                    provider,
                );
            }

            case "quiz": {
                const provider =
                    requireResolvedProvider(
                        preflight,
                        targetId,
                    );

                const quizOptions:
                    QuizExecutionOptions = {
                        ...(options.quizLevel === undefined
                            ? {}
                            : {
                                level:
                                    options.quizLevel,
                            }),
                        ...(options.quizQuantity === undefined
                            ? {}
                            : {
                                quantity:
                                    options.quizQuantity,
                            }),
                        ...(options.themeMissionMaterialId === undefined
                            ? {}
                            : {
                                themeMissionMaterialId:
                                    options.themeMissionMaterialId,
                            }),
                    };

                return this.quiz.execute(
                    context,
                    provider,
                    quizOptions,
                );
            }

            case "interactive-path": {
                const provider =
                    requireResolvedProvider(
                        preflight,
                        targetId,
                    );

                return this.interactivePath.execute(
                    context,
                    {
                        level:
                            options.interactivePathLevel ??
                            "basic",
                    },
                    provider,
                );
            }

            case "code":
            case "discursive": {
                const provider =
                    requireResolvedProvider(
                        preflight,
                        targetId,
                    );

                return {
                    status:
                        "unsupported",
                    targetId,
                    strategy:
                        "ai",
                    message:
                        `O provider '${provider.name}' está disponível, mas o executor específico de '${targetId}' ainda não foi implementado.`,
                    details: {
                        providerId:
                            provider.id,
                        providerName:
                            provider.name,
                    },
                };
            }
        }
    }

    /**
     * Executes a mission-level bonus game in ClassHero's fixed Challenge mode.
     *
     * Native games never resolve an AI provider. Hangman resolves and verifies
     * its provider before the puzzle endpoint is called, so a missing AI
     * configuration can never create a partially-started bonus game.
     */
    async executeMissionBonus(
        mission: MissionAutomationContext,
        targetId: MissionBonusGameTargetId,
        preferredProviderId?: string,
    ): Promise<AutomationExecutionResult> {
        const bonusEligibility =
            await this.verifyMissionBonusEligibility(
                mission,
                targetId,
            );

        if (!bonusEligibility.allowed) {
            return {
                status:
                    "blocked",
                targetId,
                strategy:
                    targetId === "hangman"
                        ? "ai"
                        : "native",
                message:
                    bonusEligibility.reason,
                details: {
                    source:
                        bonusEligibility.source,
                    ...(bonusEligibility.missionBonusXp === undefined
                        ? {}
                        : { missionBonusXp: bonusEligibility.missionBonusXp }),
                },
            };
        }

        switch (targetId) {
            case "memory":
                return this.memory.executeMission(
                    mission,
                    "desafio",
                );

            case "word-search":
                return this.wordSearch.executeMission(
                    mission,
                    "desafio",
                );

            case "hangman": {
                const provider = await this.resolveProvider(
                    "hangman",
                    preferredProviderId,
                );

                if (!provider) {
                    return providerBlocked(
                        "hangman",
                        "hangman",
                        "A Forca bônus exige IA, mas nenhum provider compatível está disponível. Nenhum puzzle foi iniciado.",
                    );
                }

                return this.hangman.executeMission(
                    mission,
                    provider,
                    "desafio",
                );
            }
        }
    }

    /**
     * Re-checks the one-shot mission bonus at engine level so direct service
     * callers cannot bypass the interactive MissionBonusGameFlow.
     */
    private async verifyMissionBonusEligibility(
        mission: MissionAutomationContext,
        targetId: MissionBonusGameTargetId,
    ): Promise<{
        readonly allowed: boolean;
        readonly reason: string;
        readonly source: "xp-progress" | "games-available" | "unverified";
        readonly missionBonusXp?: number;
    }> {
        if (mission.courseId) {
            const xp =
                await this.api.xpProgress.missions(
                    mission.courseId,
                );

            if (xp.ok) {
                const current =
                    xp.response.missions.find(
                        (item) =>
                            item.theme_id ===
                            mission.missionId,
                    );

                if (
                    current &&
                    current.mission_bonus_xp > 0
                ) {
                    return {
                        allowed:
                            false,
                        reason:
                            "O jogo bônus desta missão já foi realizado e só pode ser executado uma vez.",
                        source:
                            "xp-progress",
                        missionBonusXp:
                            current.mission_bonus_xp,
                    };
                }
            }
        }

        const available =
            await this.api.games.available({
                materialId:
                    mission.missionId,
                mode:
                    "desafio",
            });

        if (!available.ok) {
            return {
                allowed:
                    false,
                reason:
                    `Não foi possível verificar a elegibilidade do jogo bônus (HTTP ${available.status}); nenhum jogo foi iniciado.`,
                source:
                    "unverified",
            };
        }

        const advertised =
            available.response.games.some(
                (game) =>
                    String(game.id) ===
                    targetId,
            );

        return advertised
            ? {
                allowed:
                    true,
                reason:
                    "O ClassHero ainda anuncia este jogo como bônus disponível.",
                source:
                    "games-available",
            }
            : {
                allowed:
                    false,
                reason:
                    `O ClassHero não anuncia '${targetId}' como jogo bônus disponível para esta missão.`,
                source:
                    "games-available",
            };
    }

    private async resolvePreflight(
        targetId: AutomationTargetId,
        preferredProviderId?: string,
    ): Promise<ResolvedAutomationPreflight> {
        const capability =
            AI_CAPABILITY_BY_TARGET[
                targetId
            ];

        if (
            capability ===
            undefined
        ) {
            return {
                ready:
                    true,
                targetId,
                requiresAI:
                    false,
            };
        }

        const provider =
            await this.resolveProvider(
                capability,
                preferredProviderId,
            );

        if (!provider) {
            const preferredMessage =
                preferredProviderId ===
                undefined
                    ? ""
                    : ` O provider preferido '${preferredProviderId}' não está configurado, não está disponível ou não suporta essa capacidade.`;

            return {
                ready:
                    false,
                targetId,
                requiresAI:
                    true,
                capability,
                message:
                    `A automação '${targetId}' exige IA, mas nenhum AI Provider compatível com '${capability}' está disponível.${preferredMessage} Configure e valide um provider antes de iniciar esta atividade.`,
            };
        }

        return {
            ready:
                true,
            targetId,
            requiresAI:
                true,
            capability,
            provider,
        };
    }

    /**
     * Finds the first compatible provider whose current configuration is
     * actually available.
     *
     * A provider health check throwing is treated as unavailable, preventing a
     * broken or partially-removed provider configuration from starting an
     * activity.
     */
    private async resolveProvider(
        capability: AIProviderCapability,
        preferredProviderId?: string,
    ): Promise<AIProvider | undefined> {
        const candidates =
            this.providers().filter(
                (provider) =>
                    provider.capabilities.includes(
                        capability,
                    ) &&
                    (
                        preferredProviderId ===
                            undefined ||
                        provider.id ===
                            preferredProviderId
                    ),
            );

        for (
            const provider of candidates
        ) {
            try {
                if (
                    !provider.isAvailable ||
                    await provider.isAvailable()
                ) {
                    return provider;
                }
            } catch {
                /*
                 * Availability checks are intentionally fail-closed. Starting
                 * a ClassHero attempt is more consequential than showing an
                 * unavailable provider as a false positive.
                 */
                continue;
            }
        }

        return undefined;
    }
}

function requireResolvedProvider(
    preflight: ResolvedAutomationPreflight,
    targetId: AutomationTargetId,
): AIProvider {
    if (
        preflight.ready &&
        preflight.requiresAI
    ) {
        return preflight.provider;
    }

    throw new Error(
        `Erro interno: o target '${targetId}' exige IA, mas chegou ao executor sem provider resolvido.`,
    );
}

function providerBlocked(
    targetId: AutomationTargetId,
    capability: AIProviderCapability,
    message?: string,
): AutomationExecutionResult {
    return {
        status:
            "blocked",
        targetId,
        strategy:
            "ai",
        message:
            message ??
            `A atividade exige IA, mas nenhum AI Provider compatível com '${capability}' está disponível.`,
    };
}
