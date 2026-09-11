import type {
    ThemeClosure,
} from "@classhero-cli/api-wrapper";
import type {
    PluginContext,
} from "@classhero-cli/plugin-api";
import type {
    MissionAutomationContext,
} from "../contracts/mission.js";
import type {
    AutomationEngine,
} from "../engine/AutomationEngine.js";
import {
    DEFAULT_MISSION_REFLECTION_PROMPT,
    createMissionReflectionProviderRequest,
    parseMissionReflectionDraft,
    type MissionReflectionDraft,
} from "../prompts/MissionReflectionPrompt.js";
import {
    editMissionText,
    parseReflectionTemplate,
    renderReflectionTemplate,
} from "./MissionEditors.js";
import {
    MissionContextLoader,
} from "./MissionContextLoader.js";
import {
    chooseMissionPrompt,
} from "./MissionPromptCustomization.js";

type ReflectionMode =
    | "manual"
    | "ai"
    | "back";

/** Interactive final-reflection flow with fully optional AI assistance. */
export class MissionReflectionFlow {
    private readonly contextLoader:
        MissionContextLoader;

    constructor(
        private readonly context: PluginContext,
        private readonly engine: AutomationEngine,
    ) {
        this.contextLoader =
            new MissionContextLoader(
                context,
            );
    }

    async run(
        mission: MissionAutomationContext,
    ): Promise<void> {
        const closureResponse =
            await this.context.api.themes.closure(
                mission.missionId,
            );

        if (!closureResponse.ok) {
            this.context.logger.error(
                `Não foi possível carregar a reflexão da missão (HTTP ${closureResponse.status}).`,
            );
            return;
        }

        const current =
            closureResponse.response;

        if (
            current.status === "submitted" &&
            current.submitted_at
        ) {
            this.context.logger.info(
                "Esta reflexão já possui um envio registrado no ClassHero. O backend pode limitar reenvios por data.",
                {
                    status: current.status,
                    submittedAt: current.submitted_at,
                },
            );
        }

        const provider =
            await this.engine.availableAIProvider(
                "reflection",
            );

        const mode =
            await this.context.prompts.run<ReflectionMode>({
                id: "classhero-ai-automator.mission-reflection.mode",
                kind: "select",
                message: `Reflexão final — ${mission.title}`,
                options: [
                    {
                        id: "classhero-ai-automator.mission-reflection.manual",
                        value: "manual",
                        label: "Preencher manualmente",
                        hint: "não usa IA e não envia conteúdos a nenhum provider",
                    },
                    {
                        id: "classhero-ai-automator.mission-reflection.ai",
                        value: "ai",
                        label: "Criar rascunho com auxílio de IA",
                        hint: provider
                            ? `provider: ${provider.name} · revisão obrigatória antes do envio`
                            : "nenhum provider de IA compatível configurado",
                        ...(provider
                            ? {}
                            : {
                                disabled:
                                    "Configure um provider com capability reflection para usar IA.",
                            }),
                    },
                    {
                        id: "classhero-ai-automator.mission-reflection.back",
                        value: "back",
                        label: "Voltar",
                    },
                ],
                initialValue: "manual",
            });

        if (
            mode.status !== "submitted" ||
            mode.value === "back"
        ) {
            return;
        }

        let draft:
            MissionReflectionDraft | undefined;

        if (mode.value === "manual") {
            draft = await this.editDraft(
                currentReflectionDraft(
                    current,
                ),
                "Preencha sua reflexão final.",
            );
        } else {
            if (!provider) {
                this.context.logger.warn(
                    "A assistência por IA não está disponível; nenhuma chamada da missão foi iniciada.",
                );
                return;
            }

            const prompt =
                await chooseMissionPrompt(
                    this.context,
                    {
                        idPrefix:
                            "classhero-ai-automator.mission-reflection",
                        title:
                            "a reflexão final",
                        defaultPrompt:
                            DEFAULT_MISSION_REFLECTION_PROMPT,
                    },
                );

            if (!prompt) {
                return;
            }

            const loaded =
                await this.contextLoader.load(
                    mission,
                );

            if (
                loaded.documents.length === 0 &&
                loaded.activitySummaries.length === 0
            ) {
                this.context.logger.warn(
                    "Nenhum conteúdo textual da missão pôde ser carregado; a IA não será chamada para evitar uma resposta genérica.",
                );
                return;
            }

            const generated =
                await provider.generate(
                    createMissionReflectionProviderRequest(
                        mission,
                        loaded,
                        prompt,
                    ),
                );

            const aiDraft =
                parseMissionReflectionDraft(
                    generated.data,
                );

            if (!aiDraft) {
                this.context.logger.error(
                    `O provider '${provider.name}' retornou uma reflexão estruturada inválida. Nada foi enviado ao ClassHero.`,
                );
                return;
            }

            /* Required review: generated text can never be submitted directly. */
            draft = await this.editDraft(
                aiDraft,
                "Revise e edite o rascunho criado pela IA antes do envio.",
            );
        }

        if (!draft) {
            return;
        }

        const confirmation =
            await this.context.prompts.run({
                id: "classhero-ai-automator.mission-reflection.submit-confirm",
                kind: "confirm",
                message: "Enviar esta reflexão final para o ClassHero?",
                initialValue: false,
            });

        if (
            confirmation.status !== "submitted" ||
            !confirmation.value
        ) {
            return;
        }

        const submitted =
            await this.context.api.themes.submitClosure(
                mission.missionId,
                {
                    status: "submitted",
                    understood_text: draft.understoodText,
                    doubts_text: draft.doubtsText,
                    application_text: draft.applicationText,
                    question_text: draft.questionText,
                },
            );

        if (!submitted.ok) {
            this.context.logger.error(
                responseMessage(
                    submitted.response,
                ) ??
                `O ClassHero recusou a reflexão (HTTP ${submitted.status}).`,
                {
                    status: submitted.status,
                },
            );
            return;
        }

        this.context.logger.info(
            "Reflexão final enviada ao ClassHero.",
            {
                missionId: mission.missionId,
                status: submitted.response.status,
                submittedAt: submitted.response.submitted_at,
            },
        );
    }

    private async editDraft(
        initial: Partial<MissionReflectionDraft>,
        message: string,
    ): Promise<MissionReflectionDraft | undefined> {
        while (true) {
            const edited = await editMissionText(
                this.context,
                {
                    id: "classhero-ai-automator.mission-reflection.editor",
                    message,
                    filename: "classhero-reflexao-final.md",
                    initialValue:
                        renderReflectionTemplate(
                            initial,
                        ),
                },
            );

            if (edited === undefined) {
                return undefined;
            }

            const parsed =
                parseReflectionTemplate(
                    edited,
                );

            if (parsed) {
                return parsed;
            }

            this.context.logger.warn(
                "Os quatro campos da reflexão precisam estar preenchidos entre seus respectivos marcadores.",
            );

            const retry = await this.context.prompts.run({
                id: "classhero-ai-automator.mission-reflection.editor.retry",
                kind: "confirm",
                message: "Abrir o editor novamente?",
                initialValue: true,
            });

            if (
                retry.status !== "submitted" ||
                !retry.value
            ) {
                return undefined;
            }
        }
    }
}

function currentReflectionDraft(
    closure: ThemeClosure,
): Partial<MissionReflectionDraft> {
    return {
        ...(closure.understood_text
            ? { understoodText: closure.understood_text }
            : {}),
        ...(closure.doubts_text
            ? { doubtsText: closure.doubts_text }
            : {}),
        ...(closure.application_text
            ? { applicationText: closure.application_text }
            : {}),
        ...(closure.question_text
            ? { questionText: closure.question_text }
            : {}),
    };
}

function responseMessage(
    value: unknown,
): string | undefined {
    if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
    ) {
        const message =
            (value as Record<string, unknown>)
                .message;

        if (typeof message === "string") {
            return message;
        }
    }

    return undefined;
}
