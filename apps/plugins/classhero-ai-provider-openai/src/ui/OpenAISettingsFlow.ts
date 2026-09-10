import type {
    PluginContext,
} from "@classhero-cli/plugin-api";
import type {
    OpenAIProviderConfig,
} from "../config/OpenAIProviderConfig.js";
import type {
    ClassHeroOpenAIProvider,
} from "../provider/OpenAIProvider.js";
import type {
    OpenAIConfigurationValidator,
} from "../validation/OpenAIConfigurationValidator.js";

type SettingsAction =
    | "configure"
    | "test"
    | "remove"
    | "back";

/**
 * CLI-owned configuration flow for the OpenAI provider.
 *
 * Only API key and model are configurable. Prompt text is intentionally not
 * exposed to users.
 */
export class OpenAISettingsFlow {
    constructor(
        private readonly context: PluginContext,
        private readonly provider: ClassHeroOpenAIProvider,
        private readonly validator: OpenAIConfigurationValidator,
    ) {}

    /** Opens the provider configuration menu. */
    async run(): Promise<void> {
        while (true) {
            const publicConfig =
                this.provider.getPublicConfig();

            const result =
                await this.context.prompts.run<SettingsAction>({
                    id: "classhero-ai-provider-openai.settings",
                    kind: "select",
                    message: "OpenAI Provider",
                    options: [
                        {
                            id: "classhero-ai-provider-openai.settings.configure",
                            value: "configure",
                            label: "Configurar API key e modelo",
                            hint: publicConfig.configured
                                ? `atual: ${publicConfig.model}`
                                : "não configurado",
                        },
                        {
                            id: "classhero-ai-provider-openai.settings.test",
                            value: "test",
                            label: "Testar configuração atual",
                            ...(publicConfig.configured
                                ? {}
                                : {
                                    disabled:
                                        "Configure o provider primeiro.",
                                }),
                        },
                        {
                            id: "classhero-ai-provider-openai.settings.remove",
                            value: "remove",
                            label: "Remover configuração",
                            ...(publicConfig.configured
                                ? {}
                                : {
                                    disabled:
                                        "Nenhuma configuração salva.",
                                }),
                        },
                        {
                            id: "classhero-ai-provider-openai.settings.back",
                            value: "back",
                            label: "Voltar",
                        },
                    ],
                });

            if (
                result.status !== "submitted" ||
                result.value === "back"
            ) {
                return;
            }

            switch (result.value) {
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
            this.provider.getConfiguration();

        const keyResult =
            await this.context.prompts.run({
                id: "classhero-ai-provider-openai.api-key",
                kind: "text",
                secret: true,
                message: current
                    ? "API key da OpenAI (pressione Enter vazio para manter a atual)"
                    : "API key da OpenAI",
                validate: (value) => {
                    if (
                        value.trim().length === 0 &&
                        !current
                    ) {
                        return "Informe uma API key.";
                    }

                    return undefined;
                },
            });

        if (keyResult.status !== "submitted") {
            return;
        }

        const apiKey =
            keyResult.value.trim().length === 0 &&
            current
                ? current.apiKey
                : keyResult.value.trim();

        const modelResult =
            await this.context.prompts.run({
                id: "classhero-ai-provider-openai.model",
                kind: "text",
                message: "Modelo da OpenAI",
                placeholder:
                    "ex.: gpt-5.6-luna",
                ...(current === undefined
                    ? {}
                    : {
                        initialValue:
                            current.model,
                    }),
                validate: (value) =>
                    value.trim().length === 0
                        ? "Informe o id do modelo."
                        : undefined,
            });

        if (modelResult.status !== "submitted") {
            return;
        }

        const model =
            modelResult.value.trim();

        this.context.logger.info(
            "Validando API key e modelo com a OpenAI antes de salvar...",
            {
                model,
            },
        );

        const validation =
            await this.validator.validate(
                apiKey,
                model,
            );

        if (!validation.ok) {
            this.context.logger.error(
                validation.message,
                {
                    ...(validation.status === undefined
                        ? {}
                        : {
                            status:
                                validation.status,
                        }),
                    ...(validation.code === undefined
                        ? {}
                        : {
                            code:
                                validation.code,
                        }),
                },
            );
            return;
        }

        const config: OpenAIProviderConfig = {
            apiKey,
            model: validation.model,
            validatedAt:
                new Date().toISOString(),
        };

        await this.provider.setValidatedConfiguration(
            config,
        );

        this.context.logger.info(
            "Configuração OpenAI validada e salva.",
            {
                model:
                    validation.model,
                apiKey:
                    this.provider
                        .getPublicConfig()
                        .maskedApiKey,
                validatedAt:
                    config.validatedAt,
                ...(validation.requestId === undefined
                    ? {}
                    : {
                        requestId:
                            validation.requestId,
                    }),
            },
        );
    }

    private async testCurrent(): Promise<void> {
        const current =
            this.provider.getConfiguration();

        if (!current) {
            this.context.logger.warn(
                "O provider OpenAI ainda não possui configuração.",
            );
            return;
        }

        this.context.logger.info(
            "Testando configuração atual da OpenAI...",
            {
                model:
                    current.model,
            },
        );

        const validation =
            await this.validator.validate(
                current.apiKey,
                current.model,
            );

        if (!validation.ok) {
            this.context.logger.error(
                validation.message,
            );
            return;
        }

        await this.provider.setValidatedConfiguration({
            ...current,
            model:
                validation.model,
            validatedAt:
                new Date().toISOString(),
        });

        this.context.logger.info(
            "Configuração OpenAI funcionando.",
            {
                model:
                    validation.model,
                ...(validation.requestId === undefined
                    ? {}
                    : {
                        requestId:
                            validation.requestId,
                    }),
            },
        );
    }

    private async remove(): Promise<void> {
        const current =
            this.provider.getPublicConfig();

        if (!current.configured) {
            return;
        }

        const confirmation =
            await this.context.prompts.run({
                id: "classhero-ai-provider-openai.remove.confirm",
                kind: "confirm",
                message: `Remover a configuração OpenAI do modelo '${current.model}'?`,
                initialValue: false,
            });

        if (
            confirmation.status !== "submitted" ||
            !confirmation.value
        ) {
            return;
        }

        await this.provider.clearConfiguration();

        this.context.logger.info(
            "Configuração OpenAI removida.",
        );
    }
}
