import OpenAI from "openai";
import type {
    AIProvider,
    AIProviderCapability,
    AIProviderRequest,
    AIProviderResult,
    AIProviderUsage,
} from "@classhero-cli/classhero-ai-automator";
import type {
    OpenAIProviderConfig,
    OpenAIProviderPublicConfig,
} from "../config/OpenAIProviderConfig.js";
import type {
    OpenAIConfigStore,
} from "../config/OpenAIConfigStore.js";

/** Capabilities implemented through the selected OpenAI text model. */
const CAPABILITIES: readonly AIProviderCapability[] = [
    "quiz",
    "hangman",
    "interactive-path",
    "code",
    "discursive",
    "structured-output",
];

/**
 * Hardcoded provider-level policy.
 *
 * Activity-specific prompts are also hardcoded, but live in the automator's
 * typed executors. There is deliberately no user-editable prompt setting.
 */
const PROVIDER_POLICY = [
    "You are an AI provider inside the ClassHero CLI automation engine.",
    "Follow the activity-specific instruction exactly.",
    "Use only the task context supplied by the caller.",
    "Do not add unrelated commentary.",
    "When a structured response format is requested, satisfy it exactly.",
].join(" ");

/**
 * OpenAI implementation of the automator's provider-neutral `AIProvider`
 * contract.
 */
export class ClassHeroOpenAIProvider implements AIProvider {
    readonly id = "openai";
    readonly name = "OpenAI";
    readonly capabilities = CAPABILITIES;

    private config: OpenAIProviderConfig | undefined;

    constructor(
        private readonly store: OpenAIConfigStore,
    ) {}

    /** Loads previously validated configuration into the active provider. */
    async initialize(): Promise<void> {
        this.config = await this.store.get();
    }

    /** Returns whether validated credentials are currently configured. */
    isAvailable(): boolean {
        return this.config !== undefined;
    }

    /** Returns non-secret status information suitable for CLI output. */
    getPublicConfig(): OpenAIProviderPublicConfig {
        const config = this.config;

        if (!config) {
            return {
                configured: false,
            };
        }

        return {
            configured: true,
            model: config.model,
            maskedApiKey: maskApiKey(
                config.apiKey,
            ),
            validatedAt:
                config.validatedAt,
        };
    }

    /** Returns a copy of the active configuration for the settings flow. */
    getConfiguration(): OpenAIProviderConfig | undefined {
        return this.config === undefined
            ? undefined
            : { ...this.config };
    }

    /**
     * Saves settings only after the settings flow has successfully validated
     * them with {@link OpenAIConfigurationValidator}.
     */
    async setValidatedConfiguration(
        config: OpenAIProviderConfig,
    ): Promise<void> {
        await this.store.set(config);
        this.config = { ...config };
    }

    /** Removes credentials and immediately makes the service unavailable. */
    async clearConfiguration(): Promise<void> {
        await this.store.clear();
        this.config = undefined;
    }

    /** Executes one hardcoded automator request through the Responses API. */
    async generate(
        request: AIProviderRequest,
    ): Promise<AIProviderResult> {
        const config = this.config;

        if (!config) {
            throw new Error(
                "O provider OpenAI não está configurado.",
            );
        }

        const client = new OpenAI({
            apiKey: config.apiKey,
        });

        const instructions = [
            PROVIDER_POLICY,
            request.systemInstruction.trim(),
        ]
            .filter(
                (part) => part.length > 0,
            )
            .join("\n\n");

        const input = JSON.stringify(
            {
                task: request.task,
                activity: {
                    title: request.activity.title,
                    materialType:
                        request.activity.materialType,
                    kind: request.activity.kind,
                    discipline:
                        request.activity.disciplineName,
                    mission:
                        request.activity.missionName,
                },
                input: request.input,
            },
            null,
            2,
        );

        try {
            const response =
                request.output?.kind === "json"
                    ? await this.createStructuredResponse(
                        client,
                        config.model,
                        instructions,
                        input,
                        request,
                    )
                    : await client.responses.create({
                        model: config.model,
                        store: false,
                        instructions,
                        input,
                    });

            const text = response.output_text.trim();

            if (text.length === 0) {
                throw new Error(
                    "A OpenAI retornou uma resposta sem conteúdo textual.",
                );
            }

            const data =
                request.output?.kind === "json"
                    ? parseJsonResponse(text)
                    : undefined;

            return {
                text,
                ...(data === undefined
                    ? {}
                    : { data }),
                model:
                    response.model ||
                    config.model,
                ...(response.usage === undefined ||
                response.usage === null
                    ? {}
                    : {
                        usage: toUsage(
                            response.usage,
                        ),
                    }),
                metadata: {
                    responseId:
                        response.id,
                    ...(typeof response._request_id === "string"
                        ? {
                            requestId:
                                response._request_id,
                        }
                        : {}),
                },
            };
        } catch (error) {
            throw toSafeProviderError(
                error,
                config.apiKey,
                config.model,
            );
        }
    }

    private createStructuredResponse(
        client: OpenAI,
        model: string,
        instructions: string,
        input: string,
        request: AIProviderRequest,
    ) {
        const output = request.output;

        if (
            !output ||
            output.kind !== "json" ||
            !output.jsonSchema
        ) {
            throw new Error(
                "Uma requisição JSON do automator precisa fornecer um JSON Schema.",
            );
        }

        return client.responses.create({
            model,
            store: false,
            instructions,
            input,
            text: {
                format: {
                    type: "json_schema",
                    name: responseFormatName(
                        request.task,
                    ),
                    ...(output.description === undefined
                        ? {}
                        : {
                            description:
                                output.description,
                        }),
                    strict: true,
                    schema: {
                        ...output.jsonSchema,
                    },
                },
            },
        });
    }
}

function toUsage(
    usage: {
        readonly input_tokens: number;
        readonly output_tokens: number;
        readonly total_tokens: number;
    },
): AIProviderUsage {
    return {
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        totalTokens: usage.total_tokens,
    };
}

function parseJsonResponse(
    value: string,
): unknown {
    try {
        return JSON.parse(value);
    } catch {
        throw new Error(
            "A OpenAI retornou texto que não pôde ser interpretado como JSON estruturado.",
        );
    }
}

function responseFormatName(
    task: string,
): string {
    return `classhero_${task}`
        .replaceAll("-", "_")
        .replace(
            /[^a-zA-Z0-9_-]/g,
            "_",
        )
        .slice(0, 64);
}

function maskApiKey(
    apiKey: string,
): string {
    const trimmed = apiKey.trim();

    if (trimmed.length <= 8) {
        return "********";
    }

    return `${trimmed.slice(0, 3)}…${trimmed.slice(-4)}`;
}

function toSafeProviderError(
    error: unknown,
    apiKey: string,
    model: string,
): Error {
    const rawMessage = error instanceof Error
        ? error.message
        : String(error);

    const message = rawMessage
        .replaceAll(
            apiKey,
            "[REDACTED]",
        )
        .trim();

    return new Error(
        message.length > 0
            ? `Falha no provider OpenAI (${model}): ${message}`
            : `Falha desconhecida no provider OpenAI (${model}).`,
        {
            cause: error,
        },
    );
}
