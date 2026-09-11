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

type MissionAction =
    | "bonus-game"
    | "reflection"
    | "back";

/**
 * Mission-scoped actions that are not normal Journey Map activities.
 *
 * Knowledge maps/syntheses intentionally do not live here anymore: each
 * `knowledge_map` Journey node appears in the normal ActivityFlow and is
 * filled from its selected activity.
 */
export class MissionActionsFlow {
    private readonly bonusGames:
        MissionBonusGameFlow;
    private readonly reflection:
        MissionReflectionFlow;

    constructor(
        private readonly context:
            PluginContext,
        engine:
            AutomationEngine,
    ) {
        this.bonusGames =
            new MissionBonusGameFlow(
                context,
                engine,
            );
        this.reflection =
            new MissionReflectionFlow(
                context,
                engine,
            );
    }

    async run(): Promise<void> {
        const snapshot =
            this.context.services
                .get(CLI_CONTEXT)
                ?.getSnapshot();

        const mission = snapshot
            ? missionContextFromSnapshot(
                snapshot,
            )
            : undefined;

        if (!mission) {
            this.context.logger.warn(
                "Selecione uma missão antes de abrir as ações da missão.",
            );
            return;
        }

        const result =
            await this.context.prompts
                .run<MissionAction>({
                    id:
                        "classhero-ai-automator.mission-actions",
                    kind:
                        "select",
                    message:
                        `Ações da missão — ${mission.title}`,
                    options: [
                        {
                            id:
                                "classhero-ai-automator.mission-actions.bonus",
                            value:
                                "bonus-game",
                            label:
                                "Jogo bônus",
                            hint:
                                "uma execução por missão · prioriza jogos nativos",
                        },
                        {
                            id:
                                "classhero-ai-automator.mission-actions.reflection",
                            value:
                                "reflection",
                            label:
                                "Reflexão final",
                            hint:
                                "manual ou rascunho com IA + revisão obrigatória",
                        },
                        {
                            id:
                                "classhero-ai-automator.mission-actions.back",
                            value:
                                "back",
                            label:
                                "Voltar",
                        },
                    ],
                });

        if (
            result.status !==
            "submitted"
        ) {
            return;
        }

        switch (result.value) {
            case "bonus-game":
                await this.bonusGames.run(
                    mission,
                );
                break;
            case "reflection":
                await this.reflection.run(
                    mission,
                );
                break;
            case "back":
                break;
        }
    }
}
