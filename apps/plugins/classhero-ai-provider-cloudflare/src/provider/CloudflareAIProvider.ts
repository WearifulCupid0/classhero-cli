import type {
    JSONSchema7,
} from "@ai-sdk/provider";
import {
    generateText,
    jsonSchema,
    Output,
} from "ai";
import {
    createAiGateway,
} from "ai-gateway-provider";
import {
    createUnified,
} from "ai-gateway-provider/providers/unified";
import type {
    AIProvider,
    AIProviderCapability,
    AIProviderRequest,
    AIProviderResult,
    AIProviderUsage,
} from "@classhero-cli/classhero-ai-automator";
import type {
    CloudflareAIProviderConfig,
    CloudflareAIProviderPublicConfig,
} from "../config/CloudflareAIProviderConfig.js";
import type {
    CloudflareAIConfigStore,
} from "../config/CloudflareAIConfigStore.js";

/** Capabilities exposed through a compatible Cloudflare Unified text model. */
const CAPABILITIES: readonly AIProviderCapability[] = [
    "quiz",
    "hangman",
    "anagram",
    "interactive-path",
    "code",
    "discursive",
    "reflection",
    "synthesis",
    "structured-output",
];

/**
 * Hardcoded provider-level policy.
 *
 * Activity-specific prompts continue to live inside classhero-ai-automator.
 */
const PROVIDER_POLICY = [
    "You are an AI provider inside the ClassHero CLI automation engine.",
    "Follow the activity-specific instruction exactly.",
    "Use only the task context supplied by the caller.",
    "Do not add unrelated commentary.",
    "When a structured response is requested, satisfy the supplied JSON Schema exactly.",
].join(" ");

/**
 * Generic AIProvider implementation using Cloudflare AI Gateway's Unified API.
 *
 * All Cloudflare routing and upstream provider settings are configured
 * through the plugin menu and persisted in plugin storage. No environment
 * variables are required.
 */
export class ClassHeroCloudflareAIProvider
implements AIProvider {
    readonly id =
        "cloudflare-ai-gateway";

    readonly name =
        "Cloudflare AI Gateway";

    readonly capabilities =
        CAPABILITIES;

    private config:
        CloudflareAIProviderConfig | undefined;

    constructor(
        private readonly store:
            CloudflareAIConfigStore,
    ) {}

    /** Loads the previously validated user configuration. */
    async initialize(): Promise<void> {
        this.config =
            await this.store.get();
    }

    /**
     * Provider availability used by the automator preflight.
     *
     * A saved validated configuration now contains every value required to
     * reach Cloudflare and the upstream provider.
     */
    isAvailable(): boolean {
        return this.config !==
            undefined;
    }

    /** Returns non-secret status safe for menus/logging. */
    getPublicConfig(): CloudflareAIProviderPublicConfig {
        const config =
            this.config;

        if (!config) {
            return {
                configured:
                    false,
                gatewayAuthenticationConfigured:
                    false,
            };
        }

        return {
            configured:
                true,
            accountId:
                maskIdentifier(
                    config.accountId,
                ),
            gatewayId:
                config.gatewayId,
            gatewayAuthenticationConfigured:
                config.gatewayToken !==
                undefined,
            ...(config.gatewayToken ===
            undefined
                ? {}
                : {
                    maskedGatewayToken:
                        maskApiKey(
                            config.gatewayToken,
                        ),
                }),
            model:
                config.model,
            maskedApiKey:
                maskApiKey(
                    config.apiKey,
                ),
            validatedAt:
                config.validatedAt,
        };
    }

    /** Returns a copy for the settings flow; the value must never be logged. */
    getConfiguration(): CloudflareAIProviderConfig | undefined {
        return this.config ===
            undefined
            ? undefined
            : {
                ...this.config,
            };
    }

    /** Persists settings only after metadata validation succeeds. */
    async setValidatedConfiguration(
        config: CloudflareAIProviderConfig,
    ): Promise<void> {
        await this.store.set(
            config,
        );

        this.config = {
            ...config,
        };
    }

    /** Removes credentials and immediately makes this provider unavailable. */
    async clearConfiguration(): Promise<void> {
        await this.store.clear();
        this.config =
            undefined;
    }

    /**
     * Executes one provider-neutral automator request through Cloudflare.
     *
     * AI SDK automatic retries are disabled to avoid hidden duplicate
     * inference charges. Cloudflare-side retries/fallbacks are also not
     * configured by this plugin.
     */
    async generate(
        request: AIProviderRequest,
    ): Promise<AIProviderResult> {
        const config =
            this.config;

        if (!config) {
            throw new Error(
                "O provider Cloudflare AI Gateway não está configurado.",
            );
        }

        const requestedModel =
            request.model?.trim();

        if (
            requestedModel !==
                undefined &&
            requestedModel.length >
                0 &&
            requestedModel !==
                config.model
        ) {
            throw new Error(
                [
                    `O automator solicitou o modelo '${requestedModel}',`,
                    `mas somente '${config.model}' foi validado para este provider.`,
                    "Configure e valide o outro modelo antes de usá-lo.",
                ].join(" "),
            );
        }

        const gateway =
            createAiGateway({
                accountId:
                    config.accountId,
                gateway:
                    config.gatewayId,
                ...(config.gatewayToken ===
                undefined
                    ? {}
                    : {
                        apiKey:
                            config.gatewayToken,
                    }),
            });

        /*
         * Passing apiKey here uses the provider key supplied in the request
         * path rather than Cloudflare Stored BYOK/Unified Billing.
         */
        const unified =
            createUnified({
                apiKey:
                    config.apiKey,
            });

        const model =
            gateway(
                unified(
                    config.model,
                ),
            );

        const system =
            [
                PROVIDER_POLICY,
                request.systemInstruction
                    .trim(),
            ]
                .filter(
                    (part) =>
                        part.length >
                        0,
                )
                .join(
                    "\n\n",
                );

        const prompt =
            JSON.stringify(
                {
                    task:
                        request.task,
                    ...(request.activity === undefined
                        ? {}
                        : {
                            activity: {
                                title: request.activity.title,
                                materialType: request.activity.materialType,
                                kind: request.activity.kind,
                                capabilities: request.activity.capabilities,
                                discipline: request.activity.disciplineName,
                                mission: request.activity.missionName,
                            },
                        }),
                    ...(request.mission === undefined
                        ? {}
                        : {
                            mission: { ...request.mission },
                        }),
                    input:
                        request.input,
                },
                null,
                2,
            );

        try {
            if (
                request.output?.kind ===
                "json"
            ) {
                const schema =
                    request.output
                        .jsonSchema;

                if (!schema) {
                    throw new Error(
                        "Uma requisição JSON do automator precisa fornecer um JSON Schema.",
                    );
                }

                const result =
                    await generateText({
                        model,
                        system,
                        prompt,
                        maxRetries:
                            0,
                        output:
                            Output.object({
                                schema:
                                    jsonSchema<unknown>(
                                        schema as JSONSchema7,
                                    ),
                                name:
                                    responseFormatName(
                                        request.task,
                                    ),
                                ...(request.output
                                    .description ===
                                undefined
                                    ? {}
                                    : {
                                        description:
                                            request.output
                                                .description,
                                    }),
                            }),
                    });

                const data =
                    result.output;

                return {
                    text:
                        JSON.stringify(
                            data,
                        ),
                    data,
                    model:
                        result.response
                            .modelId ||
                        config.model,
                    ...usageProperty(
                        result.usage,
                    ),
                    metadata: {
                        gateway:
                            "cloudflare-ai-gateway",
                        gatewayId:
                            config.gatewayId,
                        responseId:
                            result.response
                                .id,
                        finishReason:
                            result.finishReason,
                        structured:
                            true,
                    },
                };
            }

            const result =
                await generateText({
                    model,
                    system,
                    prompt,
                    maxRetries:
                        0,
                });

            const text =
                result.text.trim();

            if (
                text.length ===
                0
            ) {
                throw new Error(
                    "O modelo retornou uma resposta textual vazia.",
                );
            }

            return {
                text,
                model:
                    result.response
                        .modelId ||
                    config.model,
                ...usageProperty(
                    result.usage,
                ),
                metadata: {
                    gateway:
                        "cloudflare-ai-gateway",
                    gatewayId:
                        config.gatewayId,
                    responseId:
                        result.response.id,
                    finishReason:
                        result.finishReason,
                    structured:
                        false,
                },
            };
        } catch (error) {
            throw toSafeProviderError(
                error,
                [
                    config.apiKey,
                    config.gatewayToken,
                ],
                config.model,
            );
        }
    }
}

function usageProperty(
    usage: {
        /*
         * AI SDK's LanguageModelUsage exposes these counters as
         * `number | undefined`. With `exactOptionalPropertyTypes`, writing
         * `inputTokens?: number` does NOT accept an explicitly present
         * `undefined`, so keep `undefined` in the value type as well.
         */
        readonly inputTokens?:
            number | undefined;
        readonly outputTokens?:
            number | undefined;
        readonly totalTokens?:
            number | undefined;
    },
): {
    readonly usage?: AIProviderUsage;
} {
    const normalized:
        AIProviderUsage = {
        ...(usage.inputTokens ===
        undefined
            ? {}
            : {
                inputTokens:
                    usage
                        .inputTokens,
            }),
        ...(usage.outputTokens ===
        undefined
            ? {}
            : {
                outputTokens:
                    usage
                        .outputTokens,
            }),
        ...(usage.totalTokens ===
        undefined
            ? {}
            : {
                totalTokens:
                    usage
                        .totalTokens,
            }),
    };

    return Object.keys(
        normalized,
    ).length === 0
        ? {}
        : {
            usage:
                normalized,
        };
}

function responseFormatName(
    task: string,
): string {
    return `classhero_${task}`
        .replaceAll(
            "-",
            "_",
        )
        .replace(
            /[^a-zA-Z0-9_-]/g,
            "_",
        )
        .slice(
            0,
            64,
        );
}

function maskApiKey(
    apiKey: string,
): string {
    const trimmed =
        apiKey.trim();

    if (
        trimmed.length <=
        8
    ) {
        return "********";
    }

    return `${trimmed.slice(0, 3)}…${trimmed.slice(-4)}`;
}

function maskIdentifier(
    value: string,
): string {
    const trimmed =
        value.trim();

    if (
        trimmed.length <=
        10
    ) {
        return trimmed;
    }

    return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

function toSafeProviderError(
    error: unknown,
    secrets: readonly (
        | string
        | undefined
    )[],
    model: string,
): Error {
    let message =
        error instanceof Error
            ? error.message
            : String(error);

    for (
        const secret of secrets
    ) {
        if (
            secret !==
                undefined &&
            secret.length >
                0
        ) {
            message =
                message.replaceAll(
                    secret,
                    "[REDACTED]",
                );
        }
    }

    const safe =
        message.trim();

    return new Error(
        safe.length > 0
            ? `Falha no provider Cloudflare AI Gateway (${model}): ${safe}`
            : `Falha desconhecida no provider Cloudflare AI Gateway (${model}).`,
        {
            cause:
                error,
        },
    );
}
