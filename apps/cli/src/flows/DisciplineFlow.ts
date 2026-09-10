import * as clack from "@clack/prompts";
import type { ClassHero, StudentDiscipline } from "@classhero-cli/api-wrapper";
import type { PluginRuntime } from "@classhero-cli/plugin-api";
import { AppContext } from "../runtime/AppContext.js";

/** Selects one discipline across every student class returned by ClassHero. */
export class DisciplineFlow {
    constructor(
        private readonly api: ClassHero,
        private readonly runtime: PluginRuntime,
        private readonly context: AppContext,
    ) {}

    async run(): Promise<void> {
        const response = await this.api.classes.myDisciplines();
        if (!response.ok) {
            clack.note(`Falha ao carregar disciplinas (HTTP ${response.status}).`);
            return;
        }

        const disciplines = response.response.flatMap((studentClass) =>
            studentClass.disciplines.map((discipline) => ({ studentClass, discipline })),
        );

        if (disciplines.length === 0) {
            clack.note("Nenhuma disciplina disponível.");
            return;
        }

        const byId = new Map<string, StudentDiscipline>();
        for (const { discipline } of disciplines) {
            byId.set(discipline.class_discipline_id, discipline);
        }

        const selection = await this.runtime.prompts.run({
            id: "discipline.select",
            kind: "select",
            searchable: true,
            message: "Selecione uma disciplina",
            options: disciplines.map(({ studentClass, discipline }) => ({
                id: `discipline.${discipline.class_discipline_id}`,
                value: discipline.class_discipline_id,
                label: discipline.name,
                hint: [discipline.course_name, studentClass.code].filter(Boolean).join(" · "),
            })),
        });

        if (selection.status !== "submitted") {
            return;
        }

        const discipline = byId.get(selection.value);
        if (!discipline) {
            clack.note("A disciplina selecionada não foi encontrada na resposta atual.");
            return;
        }

        this.context.selectDiscipline(discipline);
        await this.runtime.hooks.run(
            "discipline:selected",
            { id: discipline.class_discipline_id, name: discipline.name, value: discipline },
            async () => undefined,
        );
    }
}
