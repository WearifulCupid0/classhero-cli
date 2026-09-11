import {
    CLI_CONTEXT,
    PLUGIN_API_VERSION,
    type ClassHeroPlugin,
} from "@classhero-cli/plugin-api";
import { AutomationEngine } from "./engine/AutomationEngine.js";
import { AutomationActivityLogger } from "./logging/AutomationActivityLogger.js";
import { MissionActionsFlow } from "./mission/MissionActionsFlow.js";
import { AI_PROVIDER } from "./providers/tokens.js";
import { AUTOMATION_ENGINE } from "./services/tokens.js";
import { ExecutionTimingPolicy } from "./timing/ExecutionTimingPolicy.js";
import { TimingConfigStore } from "./timing/TimingConfigStore.js";
import { AutomatorFlow } from "./ui/AutomatorFlow.js";
import { TimingSettingsFlow } from "./ui/TimingSettingsFlow.js";

/**
 * Provider-agnostic ClassHero automation plugin.
 *
 * Deterministic activities are solved locally. AI providers are discovered
 * through the service registry and are never hard-coded into this plugin.
 */
export const plugin: ClassHeroPlugin = {
    manifest: {
        id: "classhero-ai-automator",
        name: "ClassHero AI Automator",
        version: "1.8.0",
        apiVersion: PLUGIN_API_VERSION,
        description: "Automação híbrida com solvers nativos, providers de IA e política configurável de tempo mínimo.",
    },

    async enable(context) {
        const timingStore = new TimingConfigStore(
            context.storage,
        );

        const timingPolicy = new ExecutionTimingPolicy(
            timingStore,
            {
                onWait: (event) => {
                    context.logger.info(
                        "Aguardando o tempo mínimo configurado antes do envio.",
                        {
                            target: event.targetId,
                            minimumSeconds:
                                event.minimumSeconds,
                            elapsedSeconds:
                                event.elapsedSeconds,
                            remainingSeconds:
                                event.remainingSeconds,
                        },
                    );
                },
            },
        );

        const activityLogger = new AutomationActivityLogger(
            context.logger,
        );

        const engine = new AutomationEngine(
            context.api,
            () => context.services.getAll(AI_PROVIDER),
            timingPolicy,
            activityLogger,
        );

        const automatorFlow = new AutomatorFlow(
            context,
            engine,
        );

        const settingsFlow = new TimingSettingsFlow(
            context,
            timingStore,
        );

        const missionActionsFlow = new MissionActionsFlow(
            context,
            engine,
        );

        context.services.provide(
            AUTOMATION_ENGINE,
            engine,
            {
                priority: 100,
            },
        );

        context.menus.contribute<string>(
            "main",
            (menu) => {
                const snapshot = context.services
                    .get(CLI_CONTEXT)
                    ?.getSnapshot();

                if (
                    snapshot?.authenticated &&
                    snapshot.activity
                ) {
                    menu.addBefore(
                        "main.plugins",
                        {
                            id: "classhero-ai-automator.open",
                            value: "classhero-ai-automator.open",
                            label: "Automatizar atividade",
                            hint: "algoritmo nativo ou IA conforme o tipo",
                            onSelect: async () =>
                                automatorFlow.run(),
                        },
                    );
                }

                if (
                    snapshot?.authenticated &&
                    snapshot.mission
                ) {
                    menu.addBefore(
                        "main.plugins",
                        {
                            id: "classhero-ai-automator.mission-actions.open",
                            value: "classhero-ai-automator.mission-actions.open",
                            label: "Ações da missão",
                            hint: "jogo bônus, reflexão final e síntese conceitual",
                            onSelect: async () =>
                                missionActionsFlow.run(),
                        },
                    );
                }

                menu.addBefore(
                    "main.plugins",
                    {
                        id: "classhero-ai-automator.settings",
                        value: "classhero-ai-automator.settings",
                        label: "Configurações do Automator",
                        hint: "controle de tempo",
                        onSelect: async () =>
                            settingsFlow.run(),
                    },
                );
            },
            { priority: 100 },
        );

        context.hooks.use(
            "activity:selected",
            async ({ payload, next }) => {
                const result = await next();

                context.logger.debug(
                    "Nova atividade disponível para análise.",
                    {
                        activityId: payload.id,
                        ...(payload.name === undefined
                            ? {}
                            : {
                                activityName:
                                    payload.name,
                            }),
                    },
                );

                return result;
            },
        );

        const config = await timingStore.get();

        context.logger.info(
            "Automator habilitado.",
            {
                nativeSolvers: [
                    "word-search",
                    "memory",
                ],
                aiProviderCount:
                    engine.providers().length,
                timingEnabled:
                    config.enabled,
                quizSecondsPerQuestion:
                    config.quiz.secondsPerQuestion,
            },
        );
    },

    disable(context) {
        context.logger.info(
            "Automator desabilitado.",
        );
    },
};

/** Default export recognized by the ClassHero CLI PluginLoader. */
export default plugin;
