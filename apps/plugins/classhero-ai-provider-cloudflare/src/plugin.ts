import {
    AI_PROVIDER,
} from "@classhero-cli/classhero-ai-automator";
import {
    PLUGIN_API_VERSION,
    type ClassHeroPlugin,
} from "@classhero-cli/plugin-api";
import {
    CloudflareAIConfigStore,
} from "./config/CloudflareAIConfigStore.js";
import {
    ClassHeroCloudflareAIProvider,
} from "./provider/CloudflareAIProvider.js";
import {
    CloudflareAISettingsFlow,
} from "./ui/CloudflareAISettingsFlow.js";
import {
    CloudflareAIConfigurationValidator,
} from "./validation/CloudflareAIConfigurationValidator.js";

/** Generic ClassHero AI provider routed through Cloudflare AI Gateway. */
export const plugin:
    ClassHeroPlugin = {
    manifest: {
        id:
            "classhero-ai-provider-cloudflare",
        name:
            "ClassHero AI Provider — Cloudflare",
        version:
            "1.3.0",
        apiVersion:
            PLUGIN_API_VERSION,
        description:
            "Provider genérico via Cloudflare AI Gateway, com toda a configuração feita pelo menu e validação sem inferência.",
        dependencies: [
            {
                id:
                    "classhero-ai-automator",
            },
        ],
    },

    async enable(
        context,
    ) {
        const store =
            new CloudflareAIConfigStore(
                context.storage,
            );

        const provider =
            new ClassHeroCloudflareAIProvider(
                store,
            );

        await provider.initialize();

        const validator =
            new CloudflareAIConfigurationValidator();

        const settings =
            new CloudflareAISettingsFlow(
                context,
                provider,
                validator,
            );

        context.services.provide(
            AI_PROVIDER,
            provider,
            {
                priority:
                    110,
            },
        );

        context.menus.contribute<string>(
            "main",
            (
                menu,
            ) => {
                const config =
                    provider
                        .getPublicConfig();

                const option = {
                    id:
                        "classhero-ai-provider-cloudflare.settings",
                    value:
                        "classhero-ai-provider-cloudflare.settings",
                    label:
                        "Configurações Cloudflare AI",
                    hint:
                        config
                            .configured
                            ? `${config.gatewayId} · ${config.model}`
                            : "provider não configurado",
                    onSelect:
                        async () =>
                            settings.run(),
                };

                if (
                    menu.has(
                        "main.plugins",
                    )
                ) {
                    menu.addBefore(
                        "main.plugins",
                        option,
                    );
                } else {
                    menu.add(
                        option,
                    );
                }
            },
            {
                priority:
                    90,
            },
        );

        const config =
            provider
                .getPublicConfig();

        context.logger.info(
            "Cloudflare AI Gateway provider habilitado.",
            {
                configured:
                    config
                        .configured,
                ...(config
                    .accountId ===
                undefined
                    ? {}
                    : {
                        accountId:
                            config.accountId,
                    }),
                ...(config
                    .gatewayId ===
                undefined
                    ? {}
                    : {
                        gatewayId:
                            config.gatewayId,
                    }),
                gatewayAuthenticationConfigured:
                    config
                        .gatewayAuthenticationConfigured,
                ...(config.model ===
                undefined
                    ? {}
                    : {
                        model:
                            config.model,
                    }),
                ...(config
                    .maskedApiKey ===
                undefined
                    ? {}
                    : {
                        apiKey:
                            config
                                .maskedApiKey,
                    }),
                promptConfiguration:
                    "hardcoded",
                configurationSource:
                    "plugin-menu",
                configurationValidation:
                    "metadata-no-inference",
            },
        );
    },

    disable(
        context,
    ) {
        context.logger.info(
            "Cloudflare AI Gateway provider desabilitado.",
        );
    },
};

/** Default export recognized by the ClassHero CLI PluginLoader. */
export default plugin;
