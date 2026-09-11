import type {
    KnowledgeMapNode,
    KnowledgeMapRelation,
    KnowledgeMapRole,
    SaveStudentKnowledgeMapInput,
    StudentKnowledgeMap,
} from "@classhero-cli/api-wrapper";
import {
    CLI_CONTEXT,
    type PluginContext,
} from "@classhero-cli/plugin-api";
import type {
    AutomationEngine,
} from "../engine/AutomationEngine.js";
import {
    editMissionText,
} from "../mission/MissionEditors.js";
import {
    MissionContextLoader,
} from "../mission/MissionContextLoader.js";
import {
    chooseMissionPrompt,
} from "../mission/MissionPromptCustomization.js";
import {
    createKnowledgeMapProviderRequest,
    DEFAULT_FINAL_SYNTHESIS_PROMPT,
    DEFAULT_KNOWLEDGE_MAP_PROMPT,
    parseKnowledgeMapDraft,
    type KnowledgeMapActivityDraft,
} from "../prompts/KnowledgeMapActivityPrompt.js";
import {
    existingKnowledgeMapDraft,
    parseKnowledgeMapTemplate,
    renderKnowledgeMapTemplate,
} from "./KnowledgeMapEditors.js";
import {
    isFinalSynthesis,
    knowledgeMapActivityFromSnapshot,
    type KnowledgeMapActivityContext,
    type ResolvedKnowledgeMapActivity,
} from "./KnowledgeMapActivity.js";

type FillMode =
    | "manual"
    | "ai"
    | "back";

type FinalSaveMode =
    | "draft"
    | "submit"
    | "cancel";

type NonFinalSaveMode =
    | "save"
    | "cancel";

/**
 * Fills the currently selected Journey Map knowledge-map activity.
 *
 * Every knowledge-map node is treated as its own activity. The selected
 * `target_id` is verified against the map returned by the candidate API role
 * before any write/mark-opened operation occurs.
 */
export class KnowledgeMapActivityFlow {
    private readonly contextLoader:
        MissionContextLoader;

    constructor(
        private readonly context:
            PluginContext,
        private readonly engine:
            AutomationEngine,
    ) {
        this.contextLoader =
            new MissionContextLoader(
                context,
            );
    }

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
            knowledgeMapActivityFromSnapshot(
                snapshot,
            );

        if (!activity) {
            this.context.logger.warn(
                "A atividade selecionada não é um mapa conceitual/síntese da Journey Map.",
            );
            return;
        }

        const resolved =
            await this.resolveExactMap(
                activity,
            );

        if (!resolved) {
            return;
        }

        const strictFinal =
            isFinalSynthesis(
                resolved,
            );

        const referenceNodes =
            resolved.map
                .map_content
                .nodes
                .filter(
                    (node) =>
                        node.student_added !==
                        true,
                );

        if (
            referenceNodes.length ===
            0
        ) {
            this.context.logger.warn(
                "O mapa selecionado não contém nós de referência do professor; nada será salvo.",
            );
            return;
        }

        /* Mark opened only after target_id/role were proven to match. */
        await this.context.api
            .knowledgeMaps
            .markOpened(
                activity.mission
                    .missionId,
                resolved.role,
            )
            .catch(
                () => undefined,
            );

        const currentNodes =
            resolved.map
                .student_version
                ?.map_content.nodes ??
            resolved.map
                .map_content.nodes;

        const currentRelations =
            resolved.map
                .student_version
                ?.map_content
                .relations ??
            resolved.map
                .map_content.relations;

        const existing =
            existingKnowledgeMapDraft(
                referenceNodes,
                currentNodes,
            );

        const provider =
            await this.engine
                .availableAIProvider(
                    "synthesis",
                );

        const mode =
            await this.context
                .prompts
                .run<FillMode>({
                    id:
                        `classhero-ai-automator.knowledge-map.${activity.node.node_key}.mode`,
                    kind:
                        "select",
                    message:
                        `${activity.title} — preencher atividade`,
                    options: [
                        {
                            id:
                                "classhero-ai-automator.knowledge-map.manual",
                            value:
                                "manual",
                            label:
                                "Preencher manualmente",
                            hint:
                                strictFinal
                                    ? "um aprendizado + uma dúvida por tema · sem IA"
                                    : "contribuições livres para esta etapa · sem IA",
                        },
                        {
                            id:
                                "classhero-ai-automator.knowledge-map.ai",
                            value:
                                "ai",
                            label:
                                "Criar rascunho com auxílio de IA",
                            hint:
                                provider
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
                            id:
                                "classhero-ai-automator.knowledge-map.back",
                            value:
                                "back",
                            label:
                                "Voltar",
                        },
                    ],
                    initialValue:
                        "manual",
                });

        if (
            mode.status !==
                "submitted" ||
            mode.value ===
                "back"
        ) {
            return;
        }

        let draft:
            KnowledgeMapActivityDraft | undefined;

        if (
            mode.value ===
            "manual"
        ) {
            draft =
                await this.editDraft(
                    resolved,
                    referenceNodes,
                    existing,
                    strictFinal,
                    "Preencha/revise esta atividade de mapa conceitual.",
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
                            `classhero-ai-automator.knowledge-map.${activity.node.node_key}`,
                        title:
                            activity.title,
                        defaultPrompt:
                            strictFinal
                                ? DEFAULT_FINAL_SYNTHESIS_PROMPT
                                : DEFAULT_KNOWLEDGE_MAP_PROMPT,
                    },
                );

            if (!prompt) {
                return;
            }

            const loaded =
                await this.contextLoader
                    .load(
                        activity.mission,
                    );

            if (
                loaded.documents.length ===
                    0 &&
                loaded.activitySummaries
                    .length === 0
            ) {
                this.context.logger.warn(
                    "Nenhum conteúdo textual da missão pôde ser carregado; a IA não será chamada para evitar uma resposta genérica.",
                );
                return;
            }

            const generation =
                await provider.generate(
                    createKnowledgeMapProviderRequest(
                        activity,
                        resolved.map,
                        loaded,
                        referenceNodes,
                        resolved.map
                            .map_content
                            .relations,
                        strictFinal,
                        prompt,
                    ),
                );

            const generatedDraft =
                parseKnowledgeMapDraft(
                    generation.data,
                    referenceNodes,
                    strictFinal,
                );

            if (!generatedDraft) {
                this.context.logger.error(
                    `O provider '${provider.name}' não retornou contribuições válidas para o mapa selecionado. Nada foi salvo.`,
                );
                return;
            }

            /* AI content never reaches ClassHero without explicit review. */
            draft =
                await this.editDraft(
                    resolved,
                    referenceNodes,
                    generatedDraft,
                    strictFinal,
                    "Revise e edite o rascunho criado pela IA antes de salvar.",
                );
        }

        if (!draft) {
            return;
        }

        const payload =
            buildKnowledgeMapPayload(
                referenceNodes,
                currentNodes,
                currentRelations,
                draft,
            );

        if (strictFinal) {
            await this.saveFinal(
                resolved,
                payload,
                referenceNodes.length,
            );
            return;
        }

        await this.saveNonFinal(
            resolved,
            payload,
            draft.contributions.length,
        );
    }

    /**
     * Resolves the API role with GET-only probes and verifies target identity.
     * No candidate is trusted solely because its name looks plausible.
     */
    private async resolveExactMap(
        activity:
            KnowledgeMapActivityContext,
    ): Promise<ResolvedKnowledgeMapActivity | undefined> {
        for (
            const role of
                activity.roleCandidates
        ) {
            const response =
                await this.context.api
                    .knowledgeMaps
                    .student(
                        activity.mission
                            .missionId,
                        role,
                    );

            if (
                !response.ok ||
                !response.response.data
            ) {
                continue;
            }

            const map =
                response.response.data;

            if (
                map.knowledge_map_id !==
                activity.knowledgeMapId
            ) {
                continue;
            }

            return {
                activity,
                role,
                map,
            };
        }

        this.context.logger.error(
            [
                `Não foi possível resolver a rota do mapa '${activity.title}'.`,
                "Nenhum role consultado retornou o knowledge_map_id esperado; nenhuma alteração foi feita.",
            ].join(" "),
            {
                journeyNodeKey:
                    activity.node
                        .node_key,
                targetType:
                    activity.targetType,
                attemptedRoles: [
                    ...activity
                        .roleCandidates,
                ],
            },
        );

        return undefined;
    }

    private async editDraft(
        resolved:
            ResolvedKnowledgeMapActivity,
        referenceNodes:
            readonly KnowledgeMapNode[],
        initial:
            KnowledgeMapActivityDraft,
        strictFinal:
            boolean,
        message:
            string,
    ): Promise<KnowledgeMapActivityDraft | undefined> {
        let current = initial;

        while (true) {
            const edited =
                await editMissionText(
                    this.context,
                    {
                        id:
                            `classhero-ai-automator.knowledge-map.${resolved.activity.node.node_key}.editor`,
                        message,
                        filename:
                            `classhero-${safeFilename(resolved.activity.node.node_key)}.md`,
                        initialValue:
                            renderKnowledgeMapTemplate(
                                resolved.activity
                                    .title,
                                referenceNodes,
                                current,
                                strictFinal,
                            ),
                    },
                );

            if (
                edited ===
                undefined
            ) {
                return undefined;
            }

            const parsed =
                parseKnowledgeMapTemplate(
                    edited,
                    referenceNodes,
                    strictFinal,
                );

            if (parsed) {
                return parsed;
            }

            this.context.logger.warn(
                strictFinal
                    ? "A síntese final exige um APRENDIZADO e uma DUVIDA em cada tema."
                    : "Preencha pelo menos um APRENDIZADO ou uma DUVIDA mantendo os marcadores do mapa.",
                {
                    referenceThemes:
                        referenceNodes.length,
                },
            );

            const retry =
                await this.context
                    .prompts
                    .run({
                        id:
                            `classhero-ai-automator.knowledge-map.${resolved.activity.node.node_key}.editor.retry`,
                        kind:
                            "confirm",
                        message:
                            "Abrir o editor novamente?",
                        initialValue:
                            true,
                    });

            if (
                retry.status !==
                    "submitted" ||
                !retry.value
            ) {
                return undefined;
            }

            current = initial;
        }
    }

    private async saveNonFinal(
        resolved:
            ResolvedKnowledgeMapActivity,
        payload:
            SaveStudentKnowledgeMapInput,
        contributionCount:
            number,
    ): Promise<void> {
        const action =
            await this.context
                .prompts
                .run<NonFinalSaveMode>({
                    id:
                        `classhero-ai-automator.knowledge-map.${resolved.activity.node.node_key}.save-mode`,
                    kind:
                        "select",
                    message:
                        "O que fazer com o mapa revisado?",
                    options: [
                        {
                            id:
                                "classhero-ai-automator.knowledge-map.save",
                            value:
                                "save",
                            label:
                                "Salvar atividade",
                            hint:
                                "salva as contribuições no ClassHero",
                        },
                        {
                            id:
                                "classhero-ai-automator.knowledge-map.cancel",
                            value:
                                "cancel",
                            label:
                                "Cancelar sem salvar",
                        },
                    ],
                    initialValue:
                        "save",
                });

        if (
            action.status !==
                "submitted" ||
            action.value !==
                "save"
        ) {
            return;
        }

        const saved =
            await this.context.api
                .knowledgeMaps
                .save(
                    resolved.activity
                        .mission
                        .missionId,
                    resolved.role,
                    payload,
                );

        if (!saved.ok) {
            this.context.logger.error(
                responseMessage(
                    saved.response,
                ) ??
                `Não foi possível salvar '${resolved.activity.title}' (HTTP ${saved.status}).`,
            );
            return;
        }

        this.context.logger.info(
            `'${resolved.activity.title}' salva no ClassHero.`,
            {
                role:
                    resolved.role,
                contributions:
                    contributionCount,
                versionStatus:
                    saved.response.data
                        .status,
            },
        );
    }

    private async saveFinal(
        resolved:
            ResolvedKnowledgeMapActivity,
        payload:
            SaveStudentKnowledgeMapInput,
        referenceCount:
            number,
    ): Promise<void> {
        const teacherStatus =
            resolved.map
                .student_evaluation
                ?.teacher_status ??
            null;

        const submissionLocked =
            teacherStatus ===
                "approved" ||
            teacherStatus ===
                "adjusted";

        if (submissionLocked) {
            this.context.logger.warn(
                "A avaliação desta síntese já foi aprovada/ajustada pelo professor. O CLI permitirá salvar o rascunho, mas não enviará uma nova avaliação.",
                {
                    teacherStatus,
                },
            );
        }

        const action =
            await this.context
                .prompts
                .run<FinalSaveMode>({
                    id:
                        `classhero-ai-automator.knowledge-map.${resolved.activity.node.node_key}.final-save-mode`,
                    kind:
                        "select",
                    message:
                        "O que fazer com a síntese revisada?",
                    options: [
                        {
                            id:
                                "classhero-ai-automator.knowledge-map.final.draft",
                            value:
                                "draft",
                            label:
                                "Salvar como rascunho",
                        },
                        {
                            id:
                                "classhero-ai-automator.knowledge-map.final.submit",
                            value:
                                "submit",
                            label:
                                "Enviar para avaliação",
                            hint:
                                "um aprendizado + uma dúvida em cada tema",
                            ...(submissionLocked
                                ? {
                                    disabled:
                                        "Avaliação já aprovada/ajustada pelo professor.",
                                }
                                : {}),
                        },
                        {
                            id:
                                "classhero-ai-automator.knowledge-map.final.cancel",
                            value:
                                "cancel",
                            label:
                                "Cancelar sem salvar",
                        },
                    ],
                    initialValue:
                        "draft",
                });

        if (
            action.status !==
                "submitted" ||
            action.value ===
                "cancel"
        ) {
            return;
        }

        const saved =
            await this.context.api
                .knowledgeMaps
                .save(
                    resolved.activity
                        .mission
                        .missionId,
                    resolved.role,
                    payload,
                );

        if (!saved.ok) {
            this.context.logger.error(
                responseMessage(
                    saved.response,
                ) ??
                `Não foi possível salvar a síntese (HTTP ${saved.status}).`,
            );
            return;
        }

        if (
            action.value ===
            "draft"
        ) {
            this.context.logger.info(
                "Síntese salva como rascunho.",
                {
                    role:
                        resolved.role,
                    referenceThemes:
                        referenceCount,
                },
            );
            return;
        }

        const confirmation =
            await this.context.prompts
                .run({
                    id:
                        `classhero-ai-automator.knowledge-map.${resolved.activity.node.node_key}.submit-confirm`,
                    kind:
                        "confirm",
                    message:
                        "Enviar a síntese revisada para avaliação no ClassHero?",
                    initialValue:
                        false,
                });

        if (
            confirmation.status !==
                "submitted" ||
            !confirmation.value
        ) {
            this.context.logger.info(
                "O rascunho foi salvo, mas não foi enviado para avaliação.",
            );
            return;
        }

        const submitted =
            await this.context.api
                .knowledgeMaps
                .submit(
                    resolved.activity
                        .mission
                        .missionId,
                    resolved.role,
                    payload,
                );

        if (!submitted.ok) {
            this.context.logger.error(
                responseMessage(
                    submitted.response,
                ) ??
                `Não foi possível enviar a síntese para avaliação (HTTP ${submitted.status}).`,
            );
            return;
        }

        this.context.logger.info(
            "Síntese enviada para avaliação.",
            {
                role:
                    resolved.role,
                referenceThemes:
                    referenceCount,
                versionStatus:
                    submitted.response.data
                        .version?.status,
                evaluationStatus:
                    submitted.response.data
                        .evaluation?.status,
            },
        );
    }
}

/**
 * Replaces editable student idea/doubt children while preserving teacher nodes,
 * teacher relations and unrelated student nodes.
 */
export function buildKnowledgeMapPayload(
    referenceNodes:
        readonly KnowledgeMapNode[],
    currentNodes:
        readonly KnowledgeMapNode[],
    relations:
        readonly KnowledgeMapRelation[],
    draft:
        KnowledgeMapActivityDraft,
): SaveStudentKnowledgeMapInput {
    const referenceIds =
        new Set(
            referenceNodes.map(
                (node) => node.id,
            ),
        );

    const existingByKey =
        new Map<
            string,
            KnowledgeMapNode
        >();

    for (
        const node of
            currentNodes
    ) {
        if (
            node.student_added ===
                true &&
            node.parent_id &&
            referenceIds.has(
                node.parent_id,
            ) &&
            (
                node.kind === "idea" ||
                node.kind === "doubt"
            )
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
                node.student_added ===
                    true &&
                !(
                    node.parent_id &&
                    referenceIds.has(
                        node.parent_id,
                    ) &&
                    (
                        node.kind ===
                            "idea" ||
                        node.kind ===
                            "doubt"
                    )
                ),
        );

    const teacherNodes =
        referenceNodes.map(
            (node) => ({
                ...node,
            }),
        );

    const generated:
        KnowledgeMapNode[] = [];
    const usedIds =
        new Set(
            currentNodes.map(
                (node) => node.id,
            ),
        );
    let counter =
        currentNodes.length;

    for (
        const contribution of
            draft.contributions
    ) {
        const key =
            `${contribution.referenceNodeId}:${contribution.kind}`;
        const existing =
            existingByKey.get(
                key,
            );

        const id =
            existing?.id ??
            nextStudentNodeId(
                contribution.kind,
                usedIds,
                () => ++counter,
            );

        usedIds.add(id);

        generated.push({
            ...(existing ?? {}),
            id,
            label:
                contribution.text,
            parent_id:
                contribution.referenceNodeId,
            kind:
                contribution.kind,
            student_added:
                true,
        });
    }

    return {
        nodes: [
            ...teacherNodes,
            ...preservedStudentNodes,
            ...generated,
        ],
        relations:
            relations.map(
                (relation) => ({
                    ...relation,
                }),
            ),
    };
}

function nextStudentNodeId(
    kind: "idea" | "doubt",
    usedIds: ReadonlySet<string>,
    nextCounter: () => number,
): string {
    while (true) {
        const candidate =
            `student-${kind}-${nextCounter()}`;

        if (
            !usedIds.has(
                candidate,
            )
        ) {
            return candidate;
        }
    }
}

function safeFilename(
    value: string,
): string {
    return value
        .trim()
        .toLowerCase()
        .replace(
            /[^a-z0-9_-]+/g,
            "-",
        )
        .replace(
            /^-+|-+$/g,
            "",
        ) || "mapa-conceitual";
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
            (
                value as Record<
                    string,
                    unknown
                >
            ).message;

        return typeof message ===
            "string"
            ? message
            : undefined;
    }

    return undefined;
}
