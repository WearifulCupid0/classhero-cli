import type {
    GameMode,
    MissionMaterial,
    QuizLevel,
} from "@classhero-cli/api-wrapper";
import {
    CLI_CONTEXT,
    type PluginContext,
} from "@classhero-cli/plugin-api";
import { ActivityContextFactory } from "../context/ActivityContextFactory.js";
import type {
    ActivityContext,
    AutomationPlan,
    AutomationTarget,
    AutomationTargetId,
} from "../contracts/activity.js";
import type {
    AutomationEngine,
    ExecuteAutomationOptions,
} from "../engine/AutomationEngine.js";
import {
    getEnabledQuizLevels,
    getQuizLevelConfig,
} from "../quiz/QuizMaterialConfig.js";

export class AutomatorFlow {
    constructor(
        private readonly context: PluginContext,
        private readonly engine: AutomationEngine,
        private readonly contextFactory = new ActivityContextFactory(),
    ) {}

    async run(): Promise<void> {
        const snapshot =
            this.context.services
                .get(CLI_CONTEXT)
                ?.getSnapshot();

        if (!snapshot) {
            this.context.logger.warn(
                "CLI_CONTEXT não está disponível.",
            );
            return;
        }

        const activity =
            this.contextFactory.fromCliSnapshot(
                snapshot,
            );

        if (!activity) {
            this.context.logger.warn(
                "Selecione uma atividade antes de abrir o automator.",
            );
            return;
        }

        const plan =
            this.engine.inspect(
                activity,
            );

        this.logPlan(plan);

        if (plan.targets.length === 0) {
            return;
        }

        const selection =
            await this.context.prompts.run<
                AutomationTargetId | "back"
            >({
                id: "classhero-ai-automator.target",
                kind: "select",
                message: `Automatizar: ${activity.title}`,
                options: [
                    ...plan.targets.map(
                        (target) => ({
                            id: `classhero-ai-automator.target.${target.id}`,
                            value:
                                target.id,
                            label:
                                target.label,
                            hint:
                                buildTargetHint(
                                    target,
                                ),
                        }),
                    ),
                    {
                        id: "classhero-ai-automator.target.back",
                        value:
                            "back" as const,
                        label:
                            "Voltar",
                    },
                ],
            });

        if (
            selection.status !==
                "submitted" ||
            selection.value === "back"
        ) {
            return;
        }

        const target =
            plan.targets.find(
                (candidate) =>
                    candidate.id ===
                    selection.value,
            );

        if (!target) {
            return;
        }

        let options:
            ExecuteAutomationOptions = {};

        if (
            isMiniGameTarget(
                target.id,
            )
        ) {
            const mode =
                await this.selectGameMode();

            if (!mode) {
                return;
            }

            options = {
                ...options,
                mode,
            };
        }

        if (
            target.id === "quiz"
        ) {
            const quizOptions =
                await this.selectQuizOptions(
                    activity,
                );

            if (!quizOptions) {
                return;
            }

            options = {
                ...options,
                ...quizOptions,
            };
        }

        const confirmed =
            await this.context.prompts.run({
                id: "classhero-ai-automator.confirm",
                kind: "confirm",
                message: `Executar '${target.label}' agora?`,
                initialValue: false,
            });

        if (
            confirmed.status !==
                "submitted" ||
            !confirmed.value
        ) {
            return;
        }

        const result =
            await this.engine.execute(
                activity,
                target.id,
                options,
            );

        const metadata =
            result.details ?? {};

        switch (result.status) {
            case "completed":
                this.context.logger.info(
                    result.message,
                    metadata,
                );
                break;

            case "blocked":
            case "unsupported":
                this.context.logger.warn(
                    result.message,
                    metadata,
                );
                break;

            case "failed":
                this.context.logger.error(
                    result.message,
                    metadata,
                );
                break;
        }
    }

    private async selectGameMode(): Promise<GameMode | undefined> {
        const result =
            await this.context.prompts.run<GameMode>({
                id: "classhero-ai-automator.game-mode",
                kind: "select",
                message: "Modo do jogo",
                options: [
                    {
                        id: "classhero-ai-automator.mode.estudo",
                        value:
                            "estudo",
                        label:
                            "Estudo",
                        hint:
                            "prática livre",
                    },
                    {
                        id: "classhero-ai-automator.mode.foco",
                        value:
                            "foco",
                        label:
                            "Foco",
                        hint:
                            "pontuação intermediária",
                    },
                    {
                        id: "classhero-ai-automator.mode.desafio",
                        value:
                            "desafio",
                        label:
                            "Desafio",
                        hint:
                            "maior recompensa possível",
                    },
                ],
                initialValue:
                    "desafio",
            });

        return result.status ===
            "submitted"
            ? result.value
            : undefined;
    }

    private async selectQuizOptions(
        activity: ActivityContext,
    ): Promise<ExecuteAutomationOptions | undefined> {
        const active =
            await this.context.api.quizzes.activeAttempt(
                activity.materialId,
                {
                    all_available:
                        true,
                },
            );

        if (
            active.ok &&
            active.response.attempt &&
            active.response.pending_questions
                .length > 0
        ) {
            const attempt =
                active.response.attempt;

            this.context.logger.info(
                "Tentativa ativa de quiz encontrada; ela será continuada.",
                {
                    attemptId:
                        attempt.quiz_attempt_id,
                    level:
                        attempt.level,
                    pendingQuestions:
                        active.response
                            .pending_questions
                            .length,
                },
            );

            return {
                quizLevel:
                    attempt.level,
                quizQuantity:
                    active.response
                        .pending_questions
                        .length,
                themeMissionMaterialId:
                    attempt.theme_mission_material_id,
            };
        }

        const level =
            await this.selectQuizLevel(
                activity,
            );

        if (!level) {
            return undefined;
        }

        const configuredQuantity =
            getQuizLevelConfig(
                activity,
                level,
            )?.question_count ??
            10;

        const quantity =
            await this.selectQuizQuantity(
                configuredQuantity,
            );

        if (
            quantity === undefined
        ) {
            return undefined;
        }

        const source =
            activity.themeMissionMaterialId ??
            await this.selectQuizSource(
                activity,
            );

        if (!source) {
            return undefined;
        }

        this.context.logger.info(
            "Nova tentativa de quiz configurada.",
            {
                level,
                quantity,
                themeMissionMaterialId:
                    source,
            },
        );

        return {
            quizLevel:
                level,
            quizQuantity:
                quantity,
            themeMissionMaterialId:
                source,
        };
    }

    private async selectQuizLevel(
        activity: ActivityContext,
    ): Promise<QuizLevel | undefined> {
        const levels =
            getEnabledQuizLevels(
                activity,
            );

        if (levels.length === 0) {
            return "mixed";
        }

        if (levels.length === 1) {
            return levels[0]!.id;
        }

        const result =
            await this.context.prompts.run<QuizLevel>({
                id: "classhero-ai-automator.quiz-level",
                kind: "select",
                message: "Nível do quiz",
                options:
                    levels.map(
                        (level) => ({
                            id: `classhero-ai-automator.quiz-level.${level.id}`,
                            value:
                                level.id,
                            label:
                                quizLevelLabel(
                                    level.id,
                                ),
                            hint:
                                `${level.config.question_count} pergunta(s) configuradas`,
                        }),
                    ),
                initialValue:
                    levels.find(
                        (level) =>
                            level.id ===
                            "mixed",
                    )?.id ??
                    levels[0]!.id,
            });

        return result.status ===
            "submitted"
            ? result.value
            : undefined;
    }

    private async selectQuizQuantity(
        initialValue: number,
    ): Promise<number | undefined> {
        const result =
            await this.context.prompts.run({
                id: "classhero-ai-automator.quiz-quantity",
                kind: "text",
                message: "Quantidade de perguntas",
                initialValue:
                    String(
                        initialValue,
                    ),
                placeholder:
                    String(
                        initialValue,
                    ),
                validate: (value: string) => {
                    const trimmed =
                        value.trim();

                    if (
                        !/^\d+$/.test(
                            trimmed,
                        )
                    ) {
                        return "Digite uma quantidade inteira de perguntas.";
                    }

                    const parsed =
                        Number.parseInt(
                            trimmed,
                            10,
                        );

                    return parsed > 0
                        ? undefined
                        : "A quantidade precisa ser maior que zero.";
                },
            });

        if (
            result.status !==
            "submitted"
        ) {
            return undefined;
        }

        return Number.parseInt(
            result.value.trim(),
            10,
        );
    }

    private async selectQuizSource(
        activity: ActivityContext,
    ): Promise<string | undefined> {
        const response =
            await this.context.api
                .themeMaterials
                .missionMaterials(
                    activity.themeId,
                );

        if (!response.ok) {
            this.context.logger.error(
                `Não foi possível carregar os materiais-fonte do quiz (HTTP ${response.status}).`,
            );
            return undefined;
        }

        const all =
            response.response;

        const pdfs =
            all.filter(
                (material) =>
                    material.type ===
                    "pdf",
            );

        const candidates =
            pdfs.length > 0
                ? pdfs
                : all;

        if (
            candidates.length === 0
        ) {
            this.context.logger.warn(
                "Nenhum material-fonte está disponível para iniciar uma nova tentativa de quiz.",
            );
            return undefined;
        }

        if (
            candidates.length === 1
        ) {
            const selected =
                candidates[0]!;

            this.logAutomaticQuizSource(
                selected,
            );

            return selected
                .theme_mission_material_id;
        }

        const byId =
            new Map(
                candidates.map(
                    (material) => [
                        material.theme_mission_material_id,
                        material,
                    ],
                ),
            );

        const result =
            await this.context.prompts.run<string>({
                id: "classhero-ai-automator.quiz-source",
                kind: "select",
                searchable: true,
                message: "Material-fonte do quiz",
                options:
                    candidates.map(
                        (material) => ({
                            id: `classhero-ai-automator.quiz-source.${material.theme_mission_material_id}`,
                            value:
                                material.theme_mission_material_id,
                            label:
                                material.title,
                            hint:
                                material.type,
                        }),
                    ),
            });

        if (
            result.status !==
            "submitted"
        ) {
            return undefined;
        }

        const selected =
            byId.get(
                result.value,
            );

        if (selected) {
            this.logAutomaticQuizSource(
                selected,
            );
        }

        return result.value;
    }

    private logAutomaticQuizSource(
        material: MissionMaterial,
    ): void {
        this.context.logger.info(
            "Material-fonte selecionado para o quiz.",
            {
                title:
                    material.title,
                type:
                    material.type,
                themeMissionMaterialId:
                    material.theme_mission_material_id,
            },
        );
    }

    private logPlan(
        plan: AutomationPlan,
    ): void {
        this.context.logger.info(
            "Plano de automação da atividade.",
            {
                activity:
                    plan.context.title,
                materialType:
                    plan.context.materialType,
                kind:
                    plan.context.kind,
                capabilities: [
                    ...plan.context
                        .capabilities,
                ],
                reason:
                    plan.reason,
                targets:
                    plan.targets.map(
                        (target) => ({
                            id:
                                target.id,
                            strategy:
                                target.strategy,
                            executable:
                                target.executable,
                        }),
                    ),
                aiProviders:
                    this.engine.providers().map(
                        (provider) => ({
                            id:
                                provider.id,
                            name:
                                provider.name,
                            capabilities:
                                provider.capabilities,
                        }),
                    ),
            },
        );
    }
}

function quizLevelLabel(
    level: QuizLevel,
): string {
    switch (
        String(level).toLowerCase()
    ) {
        case "basic":
            return "Básico";
        case "intermediate":
            return "Intermediário";
        case "advanced":
            return "Avançado";
        case "mixed":
            return "Misto";
        default:
            return String(level);
    }
}

function isMiniGameTarget(
    targetId: AutomationTargetId,
): boolean {
    return (
        targetId === "word-search" ||
        targetId === "memory" ||
        targetId === "hangman"
    );
}

function buildTargetHint(
    target: AutomationTarget,
): string {
    if (
        target.strategy === "native"
    ) {
        return "algoritmo nativo · sem IA";
    }

    return target.executable
        ? "IA · provider necessário"
        : "IA · executor ainda não implementado";
}
