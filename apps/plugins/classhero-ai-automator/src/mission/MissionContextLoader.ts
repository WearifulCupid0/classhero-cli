import type {
    MissionMaterial,
    ThemeMaterial,
} from "@classhero-cli/api-wrapper";
import type {
    PluginContext,
} from "@classhero-cli/plugin-api";
import type {
    MissionAutomationContext,
} from "../contracts/mission.js";

const MAX_DOCUMENT_CHARS = 40_000;
const MAX_TOTAL_CHARS = 120_000;
const MAX_ACTIVITY_SUMMARY_CHARS = 4_000;

/** Text source sent to AI for mission-wide reflection/synthesis assistance. */
export interface MissionContextDocument {
    readonly id: string;
    readonly title: string;
    readonly type: string;
    readonly description: string;
    readonly content: string;
    readonly truncated: boolean;
}

/** Mission context assembled from ClassHero's own AI-ready source material. */
export interface LoadedMissionContext {
    readonly mission: MissionAutomationContext;
    readonly documents: readonly MissionContextDocument[];
    readonly activitySummaries: readonly {
        readonly id: string;
        readonly type: string;
        readonly title: string;
        readonly description: string;
        readonly content: string;
    }[];
    readonly omittedMaterialIds: readonly string[];
    readonly totalCharacters: number;
    readonly truncated: boolean;
}

/**
 * Downloads mission context only when AI assistance was explicitly selected.
 *
 * `brain-markdown` is preferred because it is the ClassHero representation
 * already prepared for AI processing. Materials explicitly opted out through
 * `exclude_from_ai_processing` are never sent to a provider.
 */
export class MissionContextLoader {
    constructor(
        private readonly context: PluginContext,
    ) {}

    async load(
        mission: MissionAutomationContext,
    ): Promise<LoadedMissionContext> {
        const [materialsResponse, activitiesResponse] =
            await Promise.all([
                this.context.api.themeMaterials.missionMaterials(
                    mission.missionId,
                ),
                this.context.api.themeMaterials.byTheme(
                    mission.missionId,
                ),
            ]);

        if (!materialsResponse.ok) {
            throw new Error(
                `Não foi possível carregar os conteúdos da missão (HTTP ${materialsResponse.status}).`,
            );
        }

        const documents: MissionContextDocument[] = [];
        const omittedMaterialIds: string[] = [];
        let remaining = MAX_TOTAL_CHARS;
        let anyTruncated = false;

        for (const material of materialsResponse.response) {
            if (material.exclude_from_ai_processing) {
                omittedMaterialIds.push(
                    material.theme_mission_material_id,
                );
                continue;
            }

            if (remaining <= 0) {
                anyTruncated = true;
                break;
            }

            const content = await this.loadMaterialText(
                mission.missionId,
                material,
            );

            if (!content.trim()) {
                continue;
            }

            const maxForDocument = Math.min(
                MAX_DOCUMENT_CHARS,
                remaining,
            );
            const clipped = clip(
                content,
                maxForDocument,
            );

            documents.push({
                id: material.theme_mission_material_id,
                title: material.title,
                type: material.type,
                description: material.description,
                content: clipped.value,
                truncated: clipped.truncated,
            });

            remaining -= clipped.value.length;
            anyTruncated ||= clipped.truncated;
        }

        const activities = activitiesResponse.ok
            ? activitiesResponse.response.map(
                summarizeThemeMaterial,
            )
            : [];

        const totalCharacters = documents.reduce(
            (sum, document) => sum + document.content.length,
            0,
        ) + activities.reduce(
            (sum, activity) => sum + activity.content.length + activity.description.length,
            0,
        );

        this.context.logger.info(
            "Contexto da missão preparado para assistência por IA.",
            {
                missionId: mission.missionId,
                downloadedDocuments: documents.length,
                activitySummaries: activities.length,
                omittedByAiOptOut: omittedMaterialIds.length,
                totalCharacters,
                truncated: anyTruncated,
            },
        );

        return {
            mission,
            documents,
            activitySummaries: activities,
            omittedMaterialIds,
            totalCharacters,
            truncated: anyTruncated,
        };
    }

    private async loadMaterialText(
        themeId: string,
        material: MissionMaterial,
    ): Promise<string> {
        const prepared =
            await this.context.api.themeMaterials.brainMarkdown(
                themeId,
                material.theme_mission_material_id,
            );

        if (
            prepared.ok &&
            typeof prepared.response.content === "string" &&
            prepared.response.content.trim().length > 0
        ) {
            return prepared.response.content;
        }

        /*
         * Some ClassHero deployments expose a direct brain_markdown_url even
         * when the typed route is unavailable. ApiClient strips ClassHero
         * credentials automatically when this points at another origin.
         */
        if (material.brain_markdown_url?.trim()) {
            const direct = await this.context.api.raw.get<string>(
                material.brain_markdown_url,
                {
                    headers: {
                        Accept: "text/plain, text/markdown, */*",
                    },
                },
            );

            if (
                direct.ok &&
                typeof direct.response === "string"
            ) {
                return direct.response;
            }
        }

        this.context.logger.warn(
            "Material da missão sem representação textual disponível para IA; ele foi omitido do contexto.",
            {
                themeMissionMaterialId:
                    material.theme_mission_material_id,
                title: material.title,
                type: material.type,
            },
        );

        return "";
    }
}

function summarizeThemeMaterial(
    material: ThemeMaterial,
): LoadedMissionContext["activitySummaries"][number] {
    return {
        id: material.material_id,
        type: material.type,
        title: material.title,
        description: clip(
            material.description ?? "",
            MAX_ACTIVITY_SUMMARY_CHARS,
        ).value,
        content: clip(
            material.content ?? "",
            MAX_ACTIVITY_SUMMARY_CHARS,
        ).value,
    };
}

function clip(
    value: string,
    maximum: number,
): {
    readonly value: string;
    readonly truncated: boolean;
} {
    if (value.length <= maximum) {
        return {
            value,
            truncated: false,
        };
    }

    return {
        value: `${value.slice(0, Math.max(0, maximum - 1))}…`,
        truncated: true,
    };
}
