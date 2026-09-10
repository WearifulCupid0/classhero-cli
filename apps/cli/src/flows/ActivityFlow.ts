import * as clack from "@clack/prompts";
import type { ClassHero, ThemeMaterial } from "@classhero-cli/api-wrapper";
import type { PluginRuntime } from "@classhero-cli/plugin-api";
import { AppContext } from "../runtime/AppContext.js";

/** Loads student-facing activities/materials for the selected mission. */
export class ActivityFlow {
    constructor(
        private readonly api: ClassHero,
        private readonly runtime: PluginRuntime,
        private readonly context: AppContext,
    ) {}

    async run(): Promise<void> {
        const mission = this.context.mission;
        if (!mission) {
            clack.note("Primeiro selecione uma missão.");
            return;
        }

        const response = await this.api.themeMaterials.byTheme(mission.id);
        if (!response.ok) {
            clack.note(`Falha ao carregar atividades (HTTP ${response.status}).`);
            return;
        }

        const activities = [...response.response].sort((a, b) => a.order - b.order);
        if (activities.length === 0) {
            clack.note("Nenhuma atividade disponível nesta missão.");
            return;
        }

        const byId = new Map<string, ThemeMaterial>(activities.map((activity) => [activity.material_id, activity]));
        const selection = await this.runtime.prompts.run({
            id: "activity.select",
            kind: "select",
            searchable: true,
            message: "Selecione uma atividade",
            options: activities.map((activity) => ({
                id: `activity.${activity.material_id}`,
                value: activity.material_id,
                label: activity.title,
                hint: buildActivityHint(activity),
            })),
        });

        if (selection.status !== "submitted") {
            return;
        }

        const activity = byId.get(selection.value);
        if (!activity) {
            clack.note("A atividade selecionada não foi encontrada na resposta atual.");
            return;
        }

        this.context.selectActivity(activity);
        await this.runtime.hooks.run(
            "activity:selected",
            { id: activity.material_id, name: activity.title, value: activity },
            async () => undefined,
        );

        clack.note([
            `Tipo: ${activity.type}`,
            `Status: ${activity.finished_flag ? "concluída" : "pendente"}`,
            activity.card_display_xp_earned == null
                ? undefined
                : `XP: ${activity.card_display_xp_earned}/${activity.card_display_xp_possible ?? "?"}`,
        ].filter((line): line is string => line !== undefined).join("\n"), activity.title);
    }
}

function buildActivityHint(activity: ThemeMaterial): string {
    const status = activity.finished_flag ? "concluída" : "pendente";
    return `${activity.type} · ${status}`;
}
