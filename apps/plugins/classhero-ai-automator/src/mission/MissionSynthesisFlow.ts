import type {
    KnowledgeMapNode,
    SaveStudentKnowledgeMapInput,
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
    DEFAULT_MISSION_SYNTHESIS_PROMPT,
    createMissionSynthesisProviderRequest,
    parseMissionSynthesisDraft,
    type MissionSynthesisDraft,
} from "../prompts/MissionSynthesisPrompt.js";
import {
    editMissionText,
    existingSynthesisDraft,
    parseSynthesisTemplate,
    renderSynthesisTemplate,
} from "./MissionEditors.js";
import {
    MissionContextLoader,
} from "./MissionContextLoader.js";
import {
    chooseMissionPrompt,
} from "./MissionPromptCustomization.js";

type SynthesisMode =
    | "manual"
    | "ai"
    | "back";

type SaveMode =
    | "draft"
    | "submit"
    | "cancel";

/** Final knowledge-map synthesis with optional, fully reviewable AI drafting. */
export class MissionSynthesisFlow {
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
        const response =
            await this.context.api.knowledgeMaps.final(
                mission.missionId,
            );

        if (!response.ok || !response.response.data) {
            this.context.logger.error(
                `Não foi possível carregar a Síntese Conceitual (HTTP ${response.status}).`,
            );
            return;
        }

        const map =
            response.response.data;

        const referenceNodes =
            map.map_content.nodes.filter(
                (node) =>
                    node.student_added !== true,
            );

        if (referenceNodes.length === 0) {
            this.context.logger.warn(
                "O mapa final não contém temas de referência do professor; nada será enviado.",
            );
            return;
        }

        await this.context.api.knowledgeMaps.markOpened(
            mission.missionId,
            "final",
        ).catch(() => undefined);

        const currentNodes =
            map.student_version
                ?.map_content.nodes ??
            map.map_content.nodes;

        const currentRelations =
            map.student_version
                ?.map_content.relations ??
            map.map_content.relations;

        const existing =
            existingSynthesisDraft(
                referenceNodes,
                currentNodes,
            );

        const provider =
            await this.engine.availableAIProvider(
                "synthesis",
            );

        const mode =
            await this.context.prompts.run<SynthesisMode>({
                id: "classhero-ai-automator.mission-synthesis.mode",
                kind: "select",
                message: `Síntese Conceitual — ${mission.title}`,
                options: [
                    {
                        id: "classhero-ai-automator.mission-synthesis.manual",
                        value: "manual",
                        label: "Preencher manualmente",
                        hint: "um aprendizado e uma dúvida final por tema · sem IA",
                    },
                    {
                        id: "classhero-ai-automator.mission-synthesis.ai",
                        value: "ai",
                        label: "Criar rascunho com auxílio de IA",
                        hint: provider
                            ? `provider: ${provider.name} · revisão obrigatória`
                            : "nenhum provider compatível configurado",
                        ...(provider
                            ? {}
                            : {
                                disabled:
                                    "Configure um provider com capability synthesis para usar IA.",
                            }),
                    },
                    {
                        id: "classhero-ai-automator.mission-synthesis.back",
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
            MissionSynthesisDraft | undefined;

        if (mode.value === "manual") {
            draft = await this.editDraft(
                referenceNodes,
                existing,
                "Preencha sua síntese conceitual.",
            );
        } else {
            if (!provider) {
                this.context.logger.warn(
                    "A assistência por IA não está disponível; nenhum conteúdo da missão foi enviado a um provider.",
                );
                return;
            }

            const prompt =
                await chooseMissionPrompt(
                    this.context,
                    {
                        idPrefix:
                            "classhero-ai-automator.mission-synthesis",
                        title:
                            "a síntese conceitual",
                        defaultPrompt:
                            DEFAULT_MISSION_SYNTHESIS_PROMPT,
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
                    "Nenhum conteúdo textual da missão pôde ser carregado; a IA não será chamada para evitar uma síntese genérica.",
                );
                return;
            }

            const generation =
                await provider.generate(
                    createMissionSynthesisProviderRequest(
                        mission,
                        loaded,
                        referenceNodes,
                        map.map_content.relations,
                        prompt,
                    ),
                );

            const aiDraft =
                parseMissionSynthesisDraft(
                    generation.data,
                    referenceNodes,
                );

            if (!aiDraft) {
                this.context.logger.error(
                    `O provider '${provider.name}' não retornou uma contribuição válida para cada tema do mapa. Nada foi salvo.`,
                );
                return;
            }

            /* Required review: AI output never reaches ClassHero directly. */
            draft = await this.editDraft(
                referenceNodes,
                aiDraft,
                "Revise e edite todos os aprendizados e dúvidas criados pela IA.",
            );
        }

        if (!draft) {
            return;
        }

        const payload =
            buildSynthesisPayload(
                referenceNodes,
                currentNodes,
                currentRelations,
                draft,
            );

        const teacherStatus =
            map.student_evaluation
                ?.teacher_status ??
            null;

        const submissionLocked =
            teacherStatus === "approved" ||
            teacherStatus === "adjusted";

        if (submissionLocked) {
            this.context.logger.warn(
                "A avaliação da síntese já foi aprovada/ajustada pelo professor. O CLI permitirá salvar o rascunho, mas não enviará uma nova avaliação.",
                { teacherStatus },
            );
        }

        const action =
            await this.context.prompts.run<SaveMode>({
                id: "classhero-ai-automator.mission-synthesis.save-mode",
                kind: "select",
                message: "O que fazer com a síntese revisada?",
                options: [
                    {
                        id: "classhero-ai-automator.mission-synthesis.save-draft",
                        value: "draft",
                        label: "Salvar como rascunho",
                    },
                    {
                        id: "classhero-ai-automator.mission-synthesis.submit",
                        value: "submit",
                        label: "Enviar para avaliação",
                        hint: "um aprendizado + uma dúvida em cada tema",
                        ...(submissionLocked
                            ? {
                                disabled:
                                    "Avaliação já aprovada/ajustada pelo professor.",
                            }
                            : {}),
                    },
                    {
                        id: "classhero-ai-automator.mission-synthesis.cancel",
                        value: "cancel",
                        label: "Cancelar sem salvar",
                    },
                ],
                initialValue: "draft",
            });

        if (
            action.status !== "submitted" ||
            action.value === "cancel"
        ) {
            return;
        }

        const saved =
            await this.context.api.knowledgeMaps.save(
                mission.missionId,
                "final",
                payload,
            );

        if (!saved.ok) {
            this.context.logger.error(
                responseMessage(saved.response) ??
                `Não foi possível salvar a síntese (HTTP ${saved.status}).`,
            );
            return;
        }

        if (action.value === "draft") {
            this.context.logger.info(
                "Síntese Conceitual salva como rascunho.",
                {
                    missionId: mission.missionId,
                    referenceThemes: referenceNodes.length,
                },
            );
            return;
        }

        const confirmation =
            await this.context.prompts.run({
                id: "classhero-ai-automator.mission-synthesis.submit-confirm",
                kind: "confirm",
                message: "Enviar a síntese revisada para avaliação no ClassHero?",
                initialValue: false,
            });

        if (
            confirmation.status !== "submitted" ||
            !confirmation.value
        ) {
            this.context.logger.info(
                "O rascunho foi salvo, mas não foi enviado para avaliação.",
            );
            return;
        }

        const submitted =
            await this.context.api.knowledgeMaps.submit(
                mission.missionId,
                "final",
                payload,
            );

        if (!submitted.ok) {
            this.context.logger.error(
                responseMessage(submitted.response) ??
                `Não foi possível enviar a síntese para avaliação (HTTP ${submitted.status}).`,
            );
            return;
        }

        this.context.logger.info(
            "Síntese Conceitual enviada para avaliação.",
            {
                missionId: mission.missionId,
                referenceThemes: referenceNodes.length,
                versionStatus:
                    submitted.response.data.version?.status,
                evaluationStatus:
                    submitted.response.data.evaluation?.status,
            },
        );
    }

    private async editDraft(
        referenceNodes: readonly KnowledgeMapNode[],
        initial: MissionSynthesisDraft,
        message: string,
    ): Promise<MissionSynthesisDraft | undefined> {
        let current = initial;

        while (true) {
            const edited = await editMissionText(
                this.context,
                {
                    id: "classhero-ai-automator.mission-synthesis.editor",
                    message,
                    filename: "classhero-sintese-conceitual.md",
                    initialValue:
                        renderSynthesisTemplate(
                            referenceNodes,
                            current,
                        ),
                },
            );

            if (edited === undefined) {
                return undefined;
            }

            const parsed =
                parseSynthesisTemplate(
                    edited,
                    referenceNodes,
                );

            if (parsed) {
                return parsed;
            }

            this.context.logger.warn(
                "Cada tema do mapa precisa conter um APRENDIZADO e uma DUVIDA preenchidos entre os marcadores.",
                {
                    referenceThemes:
                        referenceNodes.length,
                },
            );

            const retry = await this.context.prompts.run({
                id: "classhero-ai-automator.mission-synthesis.editor.retry",
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

            current = initial;
        }
    }
}

function buildSynthesisPayload(
    referenceNodes: readonly KnowledgeMapNode[],
    currentNodes: readonly KnowledgeMapNode[],
    relations: SaveStudentKnowledgeMapInput["relations"],
    draft: MissionSynthesisDraft,
): SaveStudentKnowledgeMapInput {
    const referenceIds =
        new Set(
            referenceNodes.map(
                (node) => node.id,
            ),
        );

    const existingByKey =
        new Map<string, KnowledgeMapNode>();

    for (const node of currentNodes) {
        if (
            node.student_added === true &&
            node.parent_id &&
            (node.kind === "idea" || node.kind === "doubt")
        ) {
            existingByKey.set(
                `${node.parent_id}:${node.kind}`,
                node,
            );
        }
    }

    const preservedStudentNodes =
        currentNodes.filter(
            (node) =>
                node.student_added === true &&
                !(
                    node.parent_id &&
                    referenceIds.has(node.parent_id) &&
                    (node.kind === "idea" || node.kind === "doubt")
                ),
        );

    const teacherNodes =
        referenceNodes.map(
            (node) => ({ ...node }),
        );

    const generated: KnowledgeMapNode[] = [];
    const usedIds = new Set(currentNodes.map((node) => node.id));
    let counter = currentNodes.length;

    for (const contribution of draft.contributions) {
        for (const kind of ["idea", "doubt"] as const) {
            const existing =
                existingByKey.get(
                    `${contribution.referenceNodeId}:${kind}`,
                );

            const label =
                kind === "idea"
                    ? contribution.idea
                    : contribution.doubt;

            const id = existing?.id ?? nextStudentNodeId(
                kind,
                usedIds,
                () => ++counter,
            );
            usedIds.add(id);

            generated.push({
                ...(existing ?? {}),
                id,
                label,
                parent_id:
                    contribution.referenceNodeId,
                kind,
                student_added:
                    true,
            });
        }
    }

    return {
        nodes: [
            ...teacherNodes,
            ...preservedStudentNodes,
            ...generated,
        ],
        relations: relations.map(
            (relation) => ({ ...relation }),
        ),
    };
}

function nextStudentNodeId(
    kind: "idea" | "doubt",
    usedIds: ReadonlySet<string>,
    nextCounter: () => number,
): string {
    while (true) {
        const candidate = `student-${kind}-${nextCounter()}`;
        if (!usedIds.has(candidate)) {
            return candidate;
        }
    }
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
            (value as Record<string, unknown>).message;

        return typeof message === "string"
            ? message
            : undefined;
    }

    return undefined;
}
