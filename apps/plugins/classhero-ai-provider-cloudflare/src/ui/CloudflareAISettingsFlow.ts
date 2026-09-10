import type {
    PluginContext,
} from "@classhero-cli/plugin-api";
import type {
    CloudflareAIProviderConfig,
} from "../config/CloudflareAIProviderConfig.js";
import type {
    ClassHeroCloudflareAIProvider,
} from "../provider/CloudflareAIProvider.js";
import type {
    CloudflareAIConfigurationValidator,
} from "../validation/CloudflareAIConfigurationValidator.js";

type SettingsAction =
    | "configure"
    | "test"
    | "remove"
    | "back";

/**
 * Interactive Cloudflare AI Gateway settings flow.
 *
 * Every value required by the provider is configured here; no Cloudflare
 * environment variables are required.
 */
export class CloudflareAISettingsFlow {
    constructor(
        private readonly context:
            PluginContext,
        private readonly provider:
            ClassHeroCloudflareAIProvider,
        private readonly validator:
            CloudflareAIConfigurationValidator,
    ) {}

    /** Opens the provider configuration menu. */
    async run(): Promise<void> {
        while (true) {
            const publicConfig =
                this.provider
                    .getPublicConfig();

            const result =
                await this.context
                    .prompts
                    .run<SettingsAction>({
                        id:
                            "classhero-ai-provider-cloudflare.settings",
                        kind:
                            "select",
                        message:
                            "Cloudflare AI Gateway Provider",
                        options: [
                            {
                                id:
                                    "classhero-ai-provider-cloudflare.settings.configure",
                                value:
                                    "configure",
                                label:
                                    "Configurar provider",
                                hint:
                                    publicConfig
                                        .configured
                                        ? `${publicConfig.gatewayId} · ${publicConfig.model}`
                                        : "Cloudflare + API key + modelo",
                            },
                            {
                                id:
                                    "classhero-ai-provider-cloudflare.settings.test",
                                value:
                                    "test",
                                label:
                                    "Testar configuração atual",
                                hint:
                                    "metadata apenas · sem inferência",
                                ...(publicConfig
                                    .configured
                                    ? {}
                                    : {
                                        disabled:
                                            "Configure o provider primeiro.",
                                    }),
                            },
                            {
                                id:
                                    "classhero-ai-provider-cloudflare.settings.remove",
                                value:
                                    "remove",
                                label:
                                    "Remover configuração",
                                ...(publicConfig
                                    .configured
                                    ? {}
                                    : {
                                        disabled:
                                            "Nenhuma configuração salva.",
                                    }),
                            },
                            {
                                id:
                                    "classhero-ai-provider-cloudflare.settings.back",
                                value:
                                    "back",
                                label:
                                    "Voltar",
                            },
                        ],
                    });

            if (
                result.status !==
                    "submitted" ||
                result.value ===
                    "back"
            ) {
                return;
            }

            switch (
                result.value
            ) {
                case "configure":
                    await this.configure();
                    break;

                case "test":
                    await this.testCurrent();
                    break;

                case "remove":
                    await this.remove();
                    break;
            }
        }
    }

    private async configure(): Promise<void> {
        const current =
            this.provider
                .getConfiguration();

        const accountResult =
            await this.context
                .prompts
                .run({
                    id:
                        "classhero-ai-provider-cloudflare.account-id",
                    kind:
                        "text",
                    message:
                        "Cloudflare Account ID",
                    placeholder:
                        "encontrado no dashboard da Cloudflare",
                    ...(current ===
                    undefined
                        ? {}
                        : {
                            initialValue:
                                current.accountId,
                        }),
                    validate:
                        (
                            value: string,
                        ) =>
                            value.trim()
                                .length >
                            0
                                ? undefined
                                : "Informe o Cloudflare Account ID.",
                });

        if (
            accountResult.status !==
            "submitted"
        ) {
            return;
        }

        const accountId =
            accountResult.value
                .trim();

        const gatewayResult =
            await this.context
                .prompts
                .run({
                    id:
                        "classhero-ai-provider-cloudflare.gateway-id",
                    kind:
                        "text",
                    message:
                        "AI Gateway ID",
                    placeholder:
                        "default",
                    initialValue:
                        current
                            ?.gatewayId ??
                        "default",
                    validate:
                        (
                            value: string,
                        ) =>
                            value.trim()
                                .length >
                            0
                                ? undefined
                                : "Informe o AI Gateway ID.",
                });

        if (
            gatewayResult.status !==
            "submitted"
        ) {
            return;
        }

        const gatewayId =
            gatewayResult.value
                .trim();

        const gatewayTokenResult =
            await this.context
                .prompts
                .run({
                    id:
                        "classhero-ai-provider-cloudflare.gateway-token",
                    kind:
                        "text",
                    secret:
                        true,
                    message:
                        current
                            ?.gatewayToken
                            ? "Cloudflare API Token (Enter vazio mantém o atual; '-' remove)"
                            : "Cloudflare API Token (opcional; Enter vazio se o gateway não exige autenticação)",
                });

        if (
            gatewayTokenResult.status !==
            "submitted"
        ) {
            return;
        }

        const rawGatewayToken =
            gatewayTokenResult.value
                .trim();

        const gatewayToken =
            rawGatewayToken ===
                "-"
                ? undefined
                : rawGatewayToken
                    .length ===
                    0
                    ? current
                        ?.gatewayToken
                    : rawGatewayToken;

        const providerKeyResult =
            await this.context
                .prompts
                .run({
                    id:
                        "classhero-ai-provider-cloudflare.api-key",
                    kind:
                        "text",
                    secret:
                        true,
                    message:
                        current
                            ? "API key do provider upstream (Enter vazio mantém a atual)"
                            : "API key do provider upstream",
                    validate:
                        (
                            value: string,
                        ) => {
                            if (
                                value
                                    .trim()
                                    .length ===
                                    0 &&
                                !current
                            ) {
                                return "Informe a API key do provider.";
                            }

                            return undefined;
                        },
                });

        if (
            providerKeyResult.status !==
            "submitted"
        ) {
            return;
        }

        const apiKey =
            providerKeyResult
                .value
                .trim()
                .length ===
                0 &&
            current
                ? current.apiKey
                : providerKeyResult
                    .value
                    .trim();

        const modelResult =
            await this.context
                .prompts
                .run({
                    id:
                        "classhero-ai-provider-cloudflare.model",
                    kind:
                        "text",
                    message:
                        "Modelo (provider/model)",
                    placeholder:
                        "ex.: openai/gpt-5.2",
                    ...(current ===
                    undefined
                        ? {}
                        : {
                            initialValue:
                                current.model,
                        }),
                    validate:
                        (
                            value: string,
                        ) => {
                            const normalized =
                                value.trim();

                            if (
                                normalized
                                    .length ===
                                0
                            ) {
                                return "Informe o id do modelo.";
                            }

                            if (
                                !normalized
                                    .includes(
                                        "/",
                                    )
                            ) {
                                return "Use o formato provider/model.";
                            }

                            return undefined;
                        },
                });

        if (
            modelResult.status !==
            "submitted"
        ) {
            return;
        }

        const model =
            modelResult.value
                .trim();

        this.context.logger.info(
            "Validando Cloudflare, API key e modelo sem executar inferência...",
            {
                gatewayId,
                model,
                cloudflareGatewayValidation:
                    gatewayToken ===
                    undefined
                        ? "sem token: validação remota do gateway será ignorada"
                        : "verificação oficial do token + metadata Cloudflare API",
                providerValidation:
                    "metadata-no-inference",
            },
        );

        const validation =
            await this.validator
                .validate({
                    accountId,
                    gatewayId,
                    ...(gatewayToken ===
                    undefined
                        ? {}
                        : {
                            gatewayToken,
                        }),
                    apiKey,
                    model,
                });

        if (!validation.ok) {
            this.context.logger.error(
                validation.message,
                {
                    ...(validation
                        .status ===
                    undefined
                        ? {}
                        : {
                            status:
                                validation.status,
                        }),
                    ...(validation
                        .code ===
                    undefined
                        ? {}
                        : {
                            code:
                                validation.code,
                        }),
                },
            );
            return;
        }

        const config:
            CloudflareAIProviderConfig =
            {
                accountId:
                    validation
                        .accountId,
                gatewayId:
                    validation
                        .gatewayId,
                ...(validation
                    .gatewayToken ===
                undefined
                    ? {}
                    : {
                        gatewayToken:
                            validation
                                .gatewayToken,
                    }),
                apiKey,
                model:
                    validation.model,
                validatedAt:
                    new Date()
                        .toISOString(),
            };

        await this.provider
            .setValidatedConfiguration(
                config,
            );

        const publicConfig =
            this.provider
                .getPublicConfig();

        this.context.logger.info(
            "Configuração Cloudflare AI Gateway validada e salva.",
            {
                accountId:
                    publicConfig
                        .accountId,
                gatewayId:
                    publicConfig
                        .gatewayId,
                gatewayAuthenticationConfigured:
                    publicConfig
                        .gatewayAuthenticationConfigured,
                model:
                    validation.model,
                provider:
                    validation.provider,
                ...(validation
                    .modelDisplayName ===
                undefined
                    ? {}
                    : {
                        modelDisplayName:
                            validation
                                .modelDisplayName,
                    }),
                apiKey:
                    publicConfig
                        .maskedApiKey,
                gatewayValidation:
                    validation
                        .gatewayValidation,
                ...(validation
                    .gatewayAuthentication ===
                undefined
                    ? {}
                    : {
                        gatewayAuthentication:
                            validation
                                .gatewayAuthentication,
                    }),
                validatedAt:
                    config.validatedAt,
                validationMode:
                    validation
                        .validationMode,
                structuredOutputSupport:
                    validation
                        .structuredOutputSupport,
            },
        );

        if (
            validation
                .gatewayValidation ===
            "not-verified-no-token"
        ) {
            this.context.logger.warn(
                [
                    "Nenhum Cloudflare API Token foi informado.",
                    "Isso é válido para um gateway sem autenticação, mas o token/gateway não puderam ser verificados remotamente.",
                    "A conectividade do gateway será confirmada na primeira inferência real.",
                ].join(" "),
                {
                    gatewayId,
                },
            );
        }

        if (
            validation
                .gatewayValidation ===
            "token-verified-no-read-permission"
        ) {
            this.context.logger.warn(
                [
                    "O Cloudflare API Token foi confirmado como válido e ativo pelo endpoint /user/tokens/verify.",
                    "Porém ele não possui permissão para consultar os metadados do gateway.",
                    "Isso é compatível com um token que tenha AI Gateway Run sem AI Gateway Read.",
                ].join(" "),
                {
                    gatewayId,
                    cloudflareTokenStatus:
                        validation
                            .cloudflareTokenStatus,
                },
            );
        }

        if (
            validation
                .structuredOutputSupport ===
            "unknown"
        ) {
            this.context.logger.warn(
                [
                    "A chave e o modelo foram validados sem inferência.",
                    "O endpoint de metadata desse provider não confirma Structured Outputs;",
                    "essa compatibilidade será validada pelo AI SDK somente na primeira geração real.",
                ].join(" "),
                {
                    model:
                        validation.model,
                },
            );
        }
    }

    private async testCurrent(): Promise<void> {
        const current =
            this.provider
                .getConfiguration();

        if (!current) {
            this.context.logger.warn(
                "O provider Cloudflare AI Gateway ainda não possui configuração.",
            );
            return;
        }

        this.context.logger.info(
            "Testando configuração por metadata, sem executar inferência...",
            {
                gatewayId:
                    current.gatewayId,
                model:
                    current.model,
            },
        );

        const validation =
            await this.validator
                .validate({
                    accountId:
                        current.accountId,
                    gatewayId:
                        current.gatewayId,
                    ...(current.gatewayToken ===
                    undefined
                        ? {}
                        : {
                            gatewayToken:
                                current.gatewayToken,
                        }),
                    apiKey:
                        current.apiKey,
                    model:
                        current.model,
                });

        if (!validation.ok) {
            this.context.logger.error(
                validation.message,
                {
                    ...(validation
                        .status ===
                    undefined
                        ? {}
                        : {
                            status:
                                validation.status,
                        }),
                    ...(validation
                        .code ===
                    undefined
                        ? {}
                        : {
                            code:
                                validation.code,
                        }),
                },
            );
            return;
        }

        const validatedAt =
            new Date()
                .toISOString();

        await this.provider
            .setValidatedConfiguration({
                ...current,
                model:
                    validation.model,
                validatedAt,
            });

        this.context.logger.info(
            "Cloudflare, API key e modelo continuam válidos.",
            {
                gatewayId:
                    validation
                        .gatewayId,
                gatewayValidation:
                    validation
                        .gatewayValidation,
                model:
                    validation.model,
                provider:
                    validation.provider,
                validationMode:
                    validation
                        .validationMode,
                structuredOutputSupport:
                    validation
                        .structuredOutputSupport,
                validatedAt,
            },
        );
    }

    private async remove(): Promise<void> {
        const current =
            this.provider
                .getPublicConfig();

        if (
            !current.configured
        ) {
            return;
        }

        const confirmation =
            await this.context
                .prompts
                .run({
                    id:
                        "classhero-ai-provider-cloudflare.remove.confirm",
                    kind:
                        "confirm",
                    message:
                        `Remover a configuração Cloudflare AI do gateway '${current.gatewayId}' e modelo '${current.model}'?`,
                    initialValue:
                        false,
                });

        if (
            confirmation.status !==
                "submitted" ||
            !confirmation.value
        ) {
            return;
        }

        await this.provider
            .clearConfiguration();

        this.context.logger.info(
            "Configuração Cloudflare AI Gateway removida.",
        );
    }
}
