import {
    CLI_CONTEXT,
    type PluginContext,
} from "@classhero-cli/plugin-api";
import {
    missionContextFromSnapshot,
} from "../contracts/mission.js";
import type {
    AutomationEngine,
} from "../engine/AutomationEngine.js";
import {
    MissionBonusGameFlow,
} from "./MissionBonusGameFlow.js";
import {
    MissionReflectionFlow,
} from "./MissionReflectionFlow.js";
import {
    MissionSynthesisFlow,
} from "./MissionSynthesisFlow.js";

type MissionAction =
    | "bonus-game"
    | "reflection"
    | "synthesis"
    | "back";

/** Entry point for mission-scoped features that are not normal activities. */
export class MissionActionsFlow {
    private readonly bonusGames: MissionBonusGameFlow;
    private readonly reflection: MissionReflectionFlow;
    private readonly synthesis: MissionSynthesisFlow;

    constructor(
        private readonly context: PluginContext,
        engine: AutomationEngine,
    ) {
        this.bonusGames = new MissionBonusGameFlow(context, engine);
        this.reflection = new MissionReflectionFlow(context, engine);
        this.synthesis = new MissionSynthesisFlow(context, engine);
    }

    async run(): Promise<void> {
        const snapshot = this.context.services
            .get(CLI_CONTEXT)
            ?.getSnapshot();

        const mission = snapshot
            ? missionContextFromSnapshot(snapshot)
            : undefined;

        if (!mission) {
            this.context.logger.warn(
                "Selecione uma missão antes de abrir as ações da missão.",
            );
            return;
        }

        const result = await this.context.prompts.run<MissionAction>({
            id: "classhero-ai-automator.mission-actions",
            kind: "select",
            message: `Ações da missão — ${mission.title}`,
            options: [
                {
                    id: "classhero-ai-automator.mission-actions.bonus",
                    value: "bonus-game",
                    label: "Jogo bônus",
                    hint: "prioriza Memória/Caça-palavras para não gastar tokens",
                },
                {
                    id: "classhero-ai-automator.mission-actions.reflection",
                    value: "reflection",
                    label: "Reflexão final",
                    hint: "manual ou rascunho com IA + revisão obrigatória",
                },
                {
                    id: "classhero-ai-automator.mission-actions.synthesis",
                    value: "synthesis",
                    label: "Síntese conceitual",
                    hint: "manual ou rascunho com IA + revisão obrigatória",
                },
                {
                    id: "classhero-ai-automator.mission-actions.back",
                    value: "back",
                    label: "Voltar",
                },
            ],
        });

        if (result.status !== "submitted") {
            return;
        }

        switch (result.value) {
            case "bonus-game":
                await this.bonusGames.run(mission);
                break;
            case "reflection":
                await this.reflection.run(mission);
                break;
            case "synthesis":
                await this.synthesis.run(mission);
                break;
            case "back":
                break;
        }
    }
}
