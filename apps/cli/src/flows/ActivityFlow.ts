import * as clack from "@clack/prompts";
import type {
    ClassHero,
    JourneyAssociatedAction,
    JourneyMapDefinition,
    JourneyMapNode,
    JourneyMapProgress,
    JourneyTargetRelation,
    MissionMaterial,
    ThemeMaterial,
} from "@classhero-cli/api-wrapper";
import type {
    CliActivityBundle,
    CliActivityTarget,
    PluginRuntime,
} from "@classhero-cli/plugin-api";
import {
    AppContext,
    type SelectedActivityBundle,
    type SelectedActivitySource,
} from "../runtime/AppContext.js";

/** One logical activity displayed by the CLI. */
interface ActivityChoice {
    readonly id: string;
    readonly name: string;
    readonly hint: string;
    readonly sortOrder: number;
    readonly value: SelectedActivityBundle;
}

/**
 * Loads student-facing logical activities for the selected mission.
 *
 * Journey Map relations are preferred because ClassHero can attach several
 * theme-material actions to the same mission material/PDF. For example, one
 * PDF can expose both a `gamified_quiz` and a `games` target.
 *
 * When Journey Map metadata is unavailable, the flow falls back to the legacy
 * one-theme-material-per-option behavior.
 */
export class ActivityFlow {
    constructor(
        private readonly api: ClassHero,
        private readonly runtime: PluginRuntime,
        private readonly context: AppContext,
    ) {}

    async run(): Promise<void> {
        const mission = this.context.mission;
        if (!mission) {
            clack.note(
                "Primeiro selecione uma missão.",
            );
            return;
        }

        /*
         * Journey Map is a first-class activity source. In particular,
         * knowledge-map/synthesis nodes may exist even when there are no
         * ThemeMaterials, so a failed/empty material request must not hide
         * them from the activity picker.
         */
        const [
            materialsResponse,
            journeyResponse,
            progressResponse,
            missionMaterialsResponse,
        ] = await Promise.all([
            this.api.themeMaterials.byTheme(
                mission.id,
            ),
            this.api.journeyMap.student(
                mission.id,
            ),
            this.api.journeyMap.studentProgress(
                mission.id,
            ),
            this.api.themeMaterials.missionMaterials(
                mission.id,
            ),
        ]);

        if (
            !materialsResponse.ok &&
            !journeyResponse.ok
        ) {
            clack.note(
                `Falha ao carregar atividades (materiais HTTP ${materialsResponse.status}; jornada HTTP ${journeyResponse.status}).`,
            );
            return;
        }

        const themeMaterials =
            materialsResponse.ok
                ? [
                    ...materialsResponse.response,
                ]
                : [];

        const choices =
            buildActivityChoices({
                themeMaterials,
                journey:
                    journeyResponse.ok
                        ? journeyResponse.response.data
                        : undefined,
                progress:
                    progressResponse.ok
                        ? progressResponse.response.data
                        : undefined,
                missionMaterials:
                    missionMaterialsResponse.ok
                        ? missionMaterialsResponse.response
                        : [],
            });

        if (choices.length === 0) {
            clack.note(
                "Nenhuma atividade selecionável foi encontrada nesta missão.",
            );
            return;
        }

        const byId =
            new Map(
                choices.map(
                    (choice) => [
                        choice.id,
                        choice,
                    ],
                ),
            );

        const selection =
            await this.runtime.prompts.run({
                id: "activity.select",
                kind: "select",
                searchable: true,
                message: "Selecione uma atividade",
                options:
                    choices.map(
                        (choice) => ({
                            id:
                                `activity.${choice.id}`,
                            value:
                                choice.id,
                            label:
                                choice.name,
                            hint:
                                choice.hint,
                        }),
                    ),
            });

        if (
            selection.status !==
            "submitted"
        ) {
            return;
        }

        const choice =
            byId.get(
                selection.value,
            );

        if (!choice) {
            clack.note(
                "A atividade selecionada não foi encontrada na resposta atual.",
            );
            return;
        }

        this.context.selectActivity(
            choice.id,
            choice.name,
            choice.value,
        );

        await this.runtime.hooks.run(
            "activity:selected",
            {
                id:
                    choice.id,
                name:
                    choice.name,
                value:
                    choice.value,
            },
            async () => undefined,
        );

        clack.note(
            describeActivity(
                choice,
            ),
            choice.name,
        );
    }
}

interface BuildActivityChoicesInput {
    readonly themeMaterials: readonly ThemeMaterial[];
    /**
     * These enrichment values are always supplied by ActivityFlow.
     * `undefined` means the corresponding optional API request was not
     * available and the legacy material fallback should be used.
     */
    readonly journey: JourneyMapDefinition | undefined;
    readonly progress: JourneyMapProgress | undefined;
    readonly missionMaterials: readonly MissionMaterial[];
}

function buildActivityChoices(
    input: BuildActivityChoicesInput,
): ActivityChoice[] {
    const materialsById =
        new Map(
            input.themeMaterials.map(
                (material) => [
                    material.material_id,
                    material,
                ],
            ),
        );

    if (!input.journey) {
        return legacyChoices(
            input.themeMaterials,
        );
    }

    const missionMaterialsById =
        new Map(
            input.missionMaterials.map(
                (material) => [
                    material.theme_mission_material_id,
                    material,
                ],
            ),
        );

    const relations =
        collectRelations(
            input.journey,
            input.progress,
        );

    const linkedThemeMaterialIds =
        new Set<string>();

    const choices:
        ActivityChoice[] = [];

    for (
        const node of [
            ...input.journey.nodes,
        ].sort(
            (left, right) =>
                left.order_index -
                right.order_index,
        )
    ) {
        if (
            node.target_scope ===
                "mission_material"
        ) {
            const targetIds =
                relations.get(
                    node.target_id,
                ) ??
                [];

            const targets =
                targetIds
                    .map(
                        (targetId) =>
                            materialsById.get(
                                targetId,
                            ),
                    )
                    .filter(
                        (
                            material,
                        ): material is ThemeMaterial =>
                            material !==
                            undefined,
                    );

            if (
                targets.length === 0
            ) {
                continue;
            }

            for (const target of targets) {
                linkedThemeMaterialIds.add(
                    target.material_id,
                );
            }

            const source =
                missionMaterialsById.get(
                    node.target_id,
                ) ??
                node;

            choices.push(
                logicalChoiceFromSource(
                    node,
                    source,
                    targets,
                ),
            );
            continue;
        }

        if (
            node.target_scope ===
                "knowledge_map"
        ) {
            choices.push(
                knowledgeMapChoice(
                    node,
                    input.progress,
                ),
            );
            continue;
        }

        if (
            node.target_scope ===
                "theme_material"
        ) {
            const material =
                materialsById.get(
                    node.target_id,
                );

            if (!material) {
                continue;
            }

            linkedThemeMaterialIds.add(
                material.material_id,
            );

            choices.push(
                standaloneChoice(
                    material,
                    node.order_index,
                    node.title,
                ),
            );
        }
    }

    /*
     * Do not lose new/legacy materials that are not represented by the current
     * Journey Map.
     */
    let tailOrder =
        Math.max(
            0,
            ...choices.map(
                (choice) =>
                    choice.sortOrder,
            ),
        ) + 1;

    for (
        const material of [
            ...input.themeMaterials,
        ].sort(
            (left, right) =>
                left.order -
                right.order,
        )
    ) {
        if (
            linkedThemeMaterialIds.has(
                material.material_id,
            )
        ) {
            continue;
        }

        choices.push(
            standaloneChoice(
                material,
                tailOrder++,
            ),
        );
    }

    return choices.sort(
        (left, right) =>
            left.sortOrder -
            right.sortOrder,
    );
}

/**
 * Builds source -> related theme-material ids using both stable Journey Map
 * generation metadata and student-specific progress associations.
 */
function collectRelations(
    journey: JourneyMapDefinition,
    progress?: JourneyMapProgress,
): Map<string, string[]> {
    const result =
        new Map<
            string,
            string[]
        >();

    for (
        const relation of
            journey
                .generation_metadata
                .target_relations ??
            []
    ) {
        addRelation(
            result,
            relation,
        );
    }

    if (progress) {
        const nodeByKey =
            new Map(
                journey.nodes.map(
                    (node) => [
                        node.node_key,
                        node,
                    ],
                ),
            );

        for (
            const [
                nodeKey,
                rawState,
            ] of Object.entries(
                progress,
            )
        ) {
            if (
                !isProgressState(
                    rawState,
                )
            ) {
                continue;
            }

            const node =
                nodeByKey.get(
                    nodeKey,
                );

            if (
                !node ||
                node.target_scope !==
                    "mission_material"
            ) {
                continue;
            }

            for (
                const action of
                    rawState
                        .associated_actions ??
                    []
            ) {
                addAssociatedAction(
                    result,
                    node.target_id,
                    action,
                );
            }
        }
    }

    return result;
}

function addRelation(
    map: Map<string, string[]>,
    relation: JourneyTargetRelation,
): void {
    if (
        relation.source_target_scope !==
            "mission_material" ||
        relation.related_target_scope !==
            "theme_material"
    ) {
        return;
    }

    appendUnique(
        map,
        relation.source_target_id,
        relation.related_target_id,
    );
}

function addAssociatedAction(
    map: Map<string, string[]>,
    sourceId: string,
    action: JourneyAssociatedAction,
): void {
    appendUnique(
        map,
        sourceId,
        action.target_id,
    );
}

function appendUnique(
    map: Map<string, string[]>,
    key: string,
    value: string,
): void {
    const current =
        map.get(key) ??
        [];

    if (
        !current.includes(
            value,
        )
    ) {
        current.push(
            value,
        );
    }

    map.set(
        key,
        current,
    );
}

function logicalChoiceFromSource(
    node: JourneyMapNode,
    source: SelectedActivitySource,
    materials: readonly ThemeMaterial[],
): ActivityChoice {
    const targets =
        materials.map(
            toCliTarget,
        );

    const sourceName =
        "title" in source &&
        typeof source.title ===
            "string"
            ? source.title
            : node.title;

    const value:
        SelectedActivityBundle = {
        kind:
            "classhero-activity-bundle",
        source: {
            id:
                node.target_id,
            name:
                sourceName,
            value:
                source,
        },
        targets,
    };

    return {
        id:
            `source:${node.target_id}`,
        name:
            node.title,
        hint:
            buildBundleHint(
                targets,
            ),
        sortOrder:
            node.order_index,
        value,
    };
}

function knowledgeMapChoice(
    node: JourneyMapNode,
    progress: JourneyMapProgress | undefined,
): ActivityChoice {
    const target:
        CliActivityTarget<JourneyMapNode> = {
        id:
            node.target_id,
        type:
            node.target_type,
        name:
            node.title,
        value:
            node,
    };

    const state =
        progress === undefined
            ? undefined
            : progress[
                node.node_key
            ];

    const completed =
        isProgressState(
            state,
        ) &&
        state.completed ===
            true;

    return {
        /* node_id keeps two Journey nodes distinct even if they target the
         * same knowledge-map resource. */
        id:
            `knowledge-map:${node.node_id}`,
        name:
            node.title,
        hint:
            `${targetTypeLabel(node.target_type)} · ${completed ? "concluída" : "pendente"}`,
        sortOrder:
            node.order_index,
        value: {
            kind:
                "classhero-activity-bundle",
            targets: [
                target,
            ],
        },
    };
}

function standaloneChoice(
    material: ThemeMaterial,
    sortOrder: number,
    displayName = material.title,
): ActivityChoice {
    const target =
        toCliTarget(
            material,
        );

    return {
        id:
            `material:${material.material_id}`,
        name:
            displayName,
        hint:
            buildBundleHint([
                target,
            ]),
        sortOrder,
        value: {
            kind:
                "classhero-activity-bundle",
            targets: [
                target,
            ],
        },
    };
}

function legacyChoices(
    materials: readonly ThemeMaterial[],
): ActivityChoice[] {
    return [
        ...materials,
    ]
        .sort(
            (left, right) =>
                left.order -
                right.order,
        )
        .map(
            (material) =>
                standaloneChoice(
                    material,
                    material.order,
                ),
        );
}

function toCliTarget(
    material: ThemeMaterial,
): CliActivityTarget<ThemeMaterial> {
    return {
        id:
            material.material_id,
        type:
            material.type,
        name:
            material.title,
        value:
            material,
    };
}

function buildBundleHint(
    targets: readonly CliActivityTarget[],
): string {
    const labels =
        unique(
            targets.map(
                (target) =>
                    targetTypeLabel(
                        target.type,
                    ),
            ),
        );

    return labels.join(
        " + ",
    );
}

function describeActivity(
    choice: ActivityChoice,
): string {
    const lines:
        string[] = [];

    if (
        choice.value.source
    ) {
        lines.push(
            `Origem: ${choice.value.source.name ?? choice.value.source.id}`,
        );
    }

    lines.push(
        `Ações: ${buildBundleHint(choice.value.targets)}`,
    );

    for (
        const target of
            choice.value.targets
    ) {
        if (
            !isThemeMaterial(
                target.value,
            )
        ) {
            continue;
        }

        lines.push(
            `${targetTypeLabel(target.type)}: ${target.value.finished_flag ? "concluída" : "pendente"}`,
        );
    }

    return lines.join(
        "\n",
    );
}

function targetTypeLabel(
    type: string,
): string {
    switch (
        type
            .trim()
            .toLowerCase()
    ) {
        case "games":
        case "game":
            return "Jogos";

        case "gamified_quiz":
        case "quiz":
            return "Quiz";

        case "gamified_interactive_path":
            return "Trilha";

        case "initial_mind_map":
            return "Mapa inicial";

        case "final_concept_map":
            return "Síntese conceitual";

        case "knowledge_map":
        case "concept_map":
            return "Síntese / mapa conceitual";

        case "code":
        case "code_challenge":
        case "code_challenge_gamified":
            return "Código";

        default:
            return type;
    }
}

function unique(
    values: readonly string[],
): string[] {
    return [
        ...new Set(
            values,
        ),
    ];
}

function isProgressState(
    value: unknown,
): value is {
    readonly completed?: boolean;
    readonly associated_actions?: readonly JourneyAssociatedAction[];
} {
    return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(
            value,
        )
    );
}

function isThemeMaterial(
    value: unknown,
): value is ThemeMaterial {
    return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(
            value,
        ) &&
        typeof (
            value as Record<
                string,
                unknown
            >
        ).material_id ===
            "string"
    );
}
