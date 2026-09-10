import * as clack from "@clack/prompts";
import type { ClassHero, XpMission } from "@classhero-cli/api-wrapper";
import type { PluginRuntime } from "@classhero-cli/plugin-api";
import { AppContext } from "../runtime/AppContext.js";

/** Loads and selects one mission for the current discipline/course. */
export class MissionFlow {
    constructor(
        private readonly api: ClassHero,
        private readonly runtime: PluginRuntime,
        private readonly context: AppContext,
    ) {}

    async run(): Promise<void> {
        const discipline = this.context.discipline;
        if (!discipline) {
            clack.note("Primeiro selecione uma disciplina.");
            return;
        }

        // HAR evidence shows `xp-progress/missions` expects `course_id`. Older
        // CLI builds used class_discipline_id, so keep it as a fallback only.
        const courseId = discipline.courseId ?? discipline.classDisciplineId;
        const response = await this.api.xp.missions(courseId);

        if (!response.ok) {
            clack.note(`Falha ao carregar missões (HTTP ${response.status}).`);
            return;
        }

        const missions = response.response.missions ?? [];
        if (missions.length === 0) {
            clack.note("Nenhuma missão disponível.");
            return;
        }

        const byId = new Map<string, XpMission>(missions.map((mission) => [mission.theme_id, mission]));
        const selection = await this.runtime.prompts.run({
            id: "mission.select",
            kind: "select",
            searchable: true,
            message: "Selecione uma missão",
            options: missions.map((mission) => ({
                id: `mission.${mission.theme_id}`,
                value: mission.theme_id,
                label: mission.mission_title,
                hint: `${mission.materials_finished}/${mission.materials_total} materiais`,
            })),
        });

        if (selection.status !== "submitted") {
            return;
        }

        const mission = byId.get(selection.value);
        if (!mission) {
            clack.note("A missão selecionada não foi encontrada na resposta atual.");
            return;
        }

        this.context.selectMission(mission);
        await this.runtime.hooks.run(
            "mission:selected",
            { id: mission.theme_id, name: mission.mission_title, value: mission },
            async () => undefined,
        );
    }
}
