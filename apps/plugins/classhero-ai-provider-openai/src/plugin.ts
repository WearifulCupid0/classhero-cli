import {
    AI_PROVIDER,
} from "@classhero-cli/classhero-ai-automator";
import {
    PLUGIN_API_VERSION,
    type ClassHeroPlugin,
} from "@classhero-cli/plugin-api";
import { OpenAIConfigStore } from "./config/OpenAIConfigStore.js";
import { ClassHeroOpenAIProvider } from "./provider/OpenAIProvider.js";
import { OpenAISettingsFlow } from "./ui/OpenAISettingsFlow.js";
import { OpenAIConfigurationValidator } from "./validation/OpenAIConfigurationValidator.js";

/**
 * OpenAI implementation of the ClassHero automator `AIProvider` contract.
 */
export const plugin: ClassHeroPlugin = {
    manifest: {
        id: "classhero-ai-provider-openai",
        name: "ClassHero AI Provider — OpenAI",
        version: "1.2.0",
        apiVersion: PLUGIN_API_VERSION,
        description: "Provider OpenAI configurado somente com API key e modelo, ambos validados antes da persistência.",
        dependencies: [
            {
                id: "classhero-ai-automator",
            },
        ],
    },

    async enable(context) {
        const store =
            new OpenAIConfigStore(
                context.storage,
            );

        const provider =
            new ClassHeroOpenAIProvider(
                store,
            );

        await provider.initialize();

        const validator =
            new OpenAIConfigurationValidator();

        const settings =
            new OpenAISettingsFlow(
                context,
                provider,
                validator,
            );

        context.services.provide(
            AI_PROVIDER,
            provider,
            {
                priority: 100,
            },
        );

        context.menus.contribute<string>(
            "main",
            (menu) => {
                const config =
                    provider.getPublicConfig();

                const option = {
                    id: "classhero-ai-provider-openai.settings",
                    value: "classhero-ai-provider-openai.settings",
                    label: "Configurações OpenAI",
                    hint: config.configured
                        ? `modelo: ${config.model}`
                        : "provider não configurado",
                    onSelect: async () =>
                        settings.run(),
                };

                if (menu.has("main.plugins")) {
                    menu.addBefore(
                        "main.plugins",
                        option,
                    );
                } else {
                    menu.add(option);
                }
            },
            {
                priority: 90,
            },
        );

        const config =
            provider.getPublicConfig();

        context.logger.info(
            "OpenAI provider habilitado.",
            {
                configured:
                    config.configured,
                ...(config.model === undefined
                    ? {}
                    : {
                        model:
                            config.model,
                    }),
                ...(config.maskedApiKey === undefined
                    ? {}
                    : {
                        apiKey:
                            config.maskedApiKey,
                    }),
                promptConfiguration:
                    "hardcoded",
            },
        );
    },

    disable(context) {
        context.logger.info(
            "OpenAI provider desabilitado.",
        );
    },
};

/** Default export recognized by the ClassHero CLI PluginLoader. */
export default plugin;
