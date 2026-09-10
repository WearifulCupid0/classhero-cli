import OpenAI from "openai";

/** Successful OpenAI credential/model validation. */
export interface OpenAIConfigurationValidationSuccess {
    readonly ok: true;
    readonly model: string;
    readonly requestId?: string;
}

/** Failed OpenAI credential/model validation. */
export interface OpenAIConfigurationValidationFailure {
    readonly ok: false;
    readonly message: string;
    readonly status?: number;
    readonly code?: string;
}

/** Result produced before provider settings are allowed to be persisted. */
export type OpenAIConfigurationValidationResult =
    | OpenAIConfigurationValidationSuccess
    | OpenAIConfigurationValidationFailure;

/**
 * Verifies that one API key can actually execute the selected model.
 *
 * Validation performs a tiny real Responses API request with a strict JSON
 * schema. This checks authentication, model access, Responses compatibility
 * and Structured Outputs support in one operation.
 */
export class OpenAIConfigurationValidator {
    async validate(
        apiKey: string,
        model: string,
    ): Promise<OpenAIConfigurationValidationResult> {
        const normalizedKey = apiKey.trim();
        const normalizedModel = model.trim();

        if (!normalizedKey) {
            return {
                ok: false,
                message: "A API key da OpenAI não pode estar vazia.",
            };
        }

        if (!normalizedModel) {
            return {
                ok: false,
                message: "O modelo da OpenAI não pode estar vazio.",
            };
        }

        const client = new OpenAI({
            apiKey: normalizedKey,
        });

        try {
            const response = await client.responses.create({
                model: normalizedModel,
                store: false,
                instructions: [
                    "This is a ClassHero CLI provider configuration validation.",
                    "Return the required structured result only.",
                    "Do not add explanations.",
                ].join(" "),
                input: "Confirm that this model can answer through the Responses API.",
                text: {
                    format: {
                        type: "json_schema",
                        name: "classhero_provider_validation",
                        description: "Tiny validation result used before saving provider settings.",
                        strict: true,
                        schema: {
                            type: "object",
                            properties: {
                                ok: {
                                    type: "boolean",
                                    const: true,
                                },
                            },
                            required: ["ok"],
                            additionalProperties: false,
                        },
                    },
                },
            });

            const parsed = parseValidationPayload(
                response.output_text,
            );

            if (!parsed) {
                return {
                    ok: false,
                    message: "A OpenAI respondeu ao teste, mas não retornou o formato estruturado esperado.",
                };
            }

            const requestId =
                typeof response._request_id === "string"
                    ? response._request_id
                    : undefined;

            return {
                ok: true,
                model: response.model || normalizedModel,
                ...(requestId === undefined
                    ? {}
                    : {
                        requestId,
                    }),
            };
        } catch (error) {
            return formatValidationError(
                error,
                normalizedKey,
                normalizedModel,
            );
        }
    }
}

function parseValidationPayload(
    text: string,
): { readonly ok: true } | undefined {
    try {
        const value = JSON.parse(text) as unknown;

        if (
            typeof value === "object" &&
            value !== null &&
            !Array.isArray(value) &&
            (value as Record<string, unknown>).ok === true
        ) {
            return { ok: true };
        }
    } catch {
        // Converted into a user-facing validation failure by the caller.
    }

    return undefined;
}

function formatValidationError(
    error: unknown,
    apiKey: string,
    model: string,
): OpenAIConfigurationValidationFailure {
    const record = isRecord(error)
        ? error
        : undefined;

    const status = typeof record?.status === "number"
        ? record.status
        : undefined;

    const code = typeof record?.code === "string"
        ? record.code
        : undefined;

    const rawMessage = error instanceof Error
        ? error.message
        : String(error);

    const safeMessage = rawMessage
        .replaceAll(apiKey, "[REDACTED]")
        .trim();

    let message: string;

    switch (status) {
        case 401:
            message = "A API key foi rejeitada pela OpenAI.";
            break;

        case 403:
            message = `A API key foi autenticada, mas não possui permissão para usar o modelo '${model}'.`;
            break;

        case 404:
            message = `O modelo '${model}' não foi encontrado ou não está disponível para esta API key.`;
            break;

        case 429:
            message = "A OpenAI recusou o teste por limite de uso, rate limit ou quota. A configuração não foi salva.";
            break;

        default:
            message = safeMessage.length > 0
                ? `Falha ao validar OpenAI: ${safeMessage}`
                : "Falha desconhecida ao validar a configuração da OpenAI.";
            break;
    }

    return {
        ok: false,
        message,
        ...(status === undefined ? {} : { status }),
        ...(code === undefined ? {} : { code }),
    };
}

function isRecord(
    value: unknown,
): value is Record<string, unknown> {
    return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
    );
}
