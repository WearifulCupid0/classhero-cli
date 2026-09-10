import type {
    CloudflareModelReference,
    MetadataValidatedProvider,
} from "../models/CloudflareModelReference.js";

/** Structured-output confidence available without executing a model. */
export type StructuredOutputSupport =
    | "supported"
    | "unknown";

/** Successful upstream metadata validation. */
export interface ProviderMetadataValidationSuccess {
    readonly ok: true;
    readonly provider: MetadataValidatedProvider;
    readonly model: string;
    readonly modelDisplayName?: string;
    readonly structuredOutputSupport: StructuredOutputSupport;
}

/** Upstream metadata validation failure. */
export interface ProviderMetadataValidationFailure {
    readonly ok: false;
    readonly message: string;
    readonly status?: number;
    readonly code?: string;
}

export type ProviderMetadataValidationResult =
    | ProviderMetadataValidationSuccess
    | ProviderMetadataValidationFailure;

/** Injectable transport used by tests without performing real HTTP requests. */
export type MetadataFetch = typeof fetch;

/**
 * Validates one upstream API key/model through metadata endpoints only.
 *
 * No text generation, chat completion, Responses API call or embedding request
 * is made by this function.
 */
export async function validateProviderMetadata(
    apiKey: string,
    reference: CloudflareModelReference,
    fetchImpl: MetadataFetch = globalThis.fetch,
): Promise<ProviderMetadataValidationResult> {
    try {
        switch (reference.provider) {
            case "openai":
                return validateOpenAI(
                    apiKey,
                    reference,
                    fetchImpl,
                );

            case "anthropic":
                return validateAnthropic(
                    apiKey,
                    reference,
                    fetchImpl,
                );

            case "google":
                return validateGoogle(
                    apiKey,
                    reference,
                    fetchImpl,
                );

            case "groq":
                return validateGroq(
                    apiKey,
                    reference,
                    fetchImpl,
                );

            case "deepseek":
                return validateDeepSeek(
                    apiKey,
                    reference,
                    fetchImpl,
                );

            case "mistral":
                return validateMistral(
                    apiKey,
                    reference,
                    fetchImpl,
                );

            case "grok":
                return validateXAI(
                    apiKey,
                    reference,
                    fetchImpl,
                );

            case "openrouter":
                return validateOpenRouter(
                    apiKey,
                    reference,
                    fetchImpl,
                );
        }
    } catch (error) {
        return {
            ok: false,
            message:
                safeTransportError(
                    error,
                    apiKey,
                    reference.provider,
                ),
            code:
                "metadata_transport_error",
        };
    }
}

async function validateOpenAI(
    apiKey: string,
    reference: CloudflareModelReference,
    fetchImpl: MetadataFetch,
): Promise<ProviderMetadataValidationResult> {
    const response =
        await requestJson(
            fetchImpl,
            `https://api.openai.com/v1/models/${encodeURIComponent(reference.modelId)}`,
            {
                Authorization:
                    `Bearer ${apiKey}`,
            },
        );

    if (!response.ok) {
        return httpFailure(
            "OpenAI",
            reference.modelId,
            response.status,
        );
    }

    if (
        !isRecord(response.data) ||
        typeof response.data.id !==
            "string"
    ) {
        return malformedResponse(
            "OpenAI",
        );
    }

    return success(
        reference,
        "unknown",
        response.data.id,
    );
}

async function validateAnthropic(
    apiKey: string,
    reference: CloudflareModelReference,
    fetchImpl: MetadataFetch,
): Promise<ProviderMetadataValidationResult> {
    const response =
        await requestJson(
            fetchImpl,
            `https://api.anthropic.com/v1/models/${encodeURIComponent(reference.modelId)}`,
            {
                "X-Api-Key":
                    apiKey,
                "anthropic-version":
                    "2023-06-01",
            },
        );

    if (!response.ok) {
        return httpFailure(
            "Anthropic",
            reference.modelId,
            response.status,
        );
    }

    if (!isRecord(response.data)) {
        return malformedResponse(
            "Anthropic",
        );
    }

    const capabilities =
        isRecord(
            response.data.capabilities,
        )
            ? response.data.capabilities
            : undefined;

    const structured =
        isRecord(
            capabilities
                ?.structured_outputs,
        )
            ? capabilities
                .structured_outputs
            : undefined;

    if (
        structured?.supported ===
        false
    ) {
        return {
            ok: false,
            message:
                `O modelo '${reference.modelId}' existe e a API key foi aceita pela Anthropic, mas os metadados informam que Structured Outputs não são suportados.`,
            code:
                "structured_output_unsupported",
        };
    }

    return success(
        reference,
        structured?.supported ===
            true
            ? "supported"
            : "unknown",
        stringValue(
            response.data.display_name,
        ) ??
            stringValue(
                response.data.id,
            ),
    );
}

async function validateGoogle(
    apiKey: string,
    reference: CloudflareModelReference,
    fetchImpl: MetadataFetch,
): Promise<ProviderMetadataValidationResult> {
    const response =
        await requestJson(
            fetchImpl,
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(reference.modelId)}`,
            {
                "x-goog-api-key":
                    apiKey,
            },
        );

    if (!response.ok) {
        return httpFailure(
            "Google AI Studio",
            reference.modelId,
            response.status,
        );
    }

    if (!isRecord(response.data)) {
        return malformedResponse(
            "Google AI Studio",
        );
    }

    if (
        Array.isArray(
            response.data
                .supportedGenerationMethods,
        ) &&
        !response.data
            .supportedGenerationMethods
            .includes(
                "generateContent",
            )
    ) {
        return {
            ok: false,
            message:
                `O modelo '${reference.modelId}' existe, mas não anuncia suporte a generateContent.`,
            code:
                "generation_unsupported",
        };
    }

    return success(
        reference,
        "unknown",
        stringValue(
            response.data.displayName,
        ) ??
            stringValue(
                response.data.name,
            ),
    );
}

async function validateGroq(
    apiKey: string,
    reference: CloudflareModelReference,
    fetchImpl: MetadataFetch,
): Promise<ProviderMetadataValidationResult> {
    const response =
        await requestJson(
            fetchImpl,
            `https://api.groq.com/openai/v1/models/${encodeURIComponent(reference.modelId)}`,
            {
                Authorization:
                    `Bearer ${apiKey}`,
            },
        );

    if (!response.ok) {
        return httpFailure(
            "Groq",
            reference.modelId,
            response.status,
        );
    }

    if (!isRecord(response.data)) {
        return malformedResponse(
            "Groq",
        );
    }

    if (
        response.data.active ===
        false
    ) {
        return {
            ok: false,
            message:
                `O modelo '${reference.modelId}' existe na Groq, mas está marcado como inativo.`,
            code:
                "model_inactive",
        };
    }

    return success(
        reference,
        "unknown",
        stringValue(
            response.data.id,
        ),
    );
}

async function validateDeepSeek(
    apiKey: string,
    reference: CloudflareModelReference,
    fetchImpl: MetadataFetch,
): Promise<ProviderMetadataValidationResult> {
    const response =
        await requestJson(
            fetchImpl,
            "https://api.deepseek.com/models",
            {
                Authorization:
                    `Bearer ${apiKey}`,
            },
        );

    if (!response.ok) {
        return httpFailure(
            "DeepSeek",
            reference.modelId,
            response.status,
        );
    }

    if (
        !isRecord(response.data) ||
        !Array.isArray(
            response.data.data,
        )
    ) {
        return malformedResponse(
            "DeepSeek",
        );
    }

    const model =
        response.data.data.find(
            (entry) =>
                isRecord(entry) &&
                entry.id ===
                    reference.modelId,
        );

    if (!model) {
        return modelNotFound(
            "DeepSeek",
            reference.modelId,
        );
    }

    return success(
        reference,
        "unknown",
        reference.modelId,
    );
}

async function validateMistral(
    apiKey: string,
    reference: CloudflareModelReference,
    fetchImpl: MetadataFetch,
): Promise<ProviderMetadataValidationResult> {
    const response =
        await requestJson(
            fetchImpl,
            `https://api.mistral.ai/v1/models/${encodeURIComponent(reference.modelId)}`,
            {
                Authorization:
                    `Bearer ${apiKey}`,
            },
        );

    if (!response.ok) {
        return httpFailure(
            "Mistral",
            reference.modelId,
            response.status,
        );
    }

    if (!isRecord(response.data)) {
        return malformedResponse(
            "Mistral",
        );
    }

    const capabilities =
        isRecord(
            response.data.capabilities,
        )
            ? response.data.capabilities
            : undefined;

    if (
        capabilities
            ?.completion_chat ===
        false
    ) {
        return {
            ok: false,
            message:
                `O modelo '${reference.modelId}' existe na Mistral, mas não oferece chat completion.`,
            code:
                "generation_unsupported",
        };
    }

    return success(
        reference,
        "unknown",
        stringValue(
            response.data.id,
        ),
    );
}

async function validateXAI(
    apiKey: string,
    reference: CloudflareModelReference,
    fetchImpl: MetadataFetch,
): Promise<ProviderMetadataValidationResult> {
    /*
     * The language-model endpoint is intentionally used instead of the generic
     * model endpoint so image/video-only models cannot pass this validator.
     */
    const response =
        await requestJson(
            fetchImpl,
            `https://api.x.ai/v1/language-models/${encodeURIComponent(reference.modelId)}`,
            {
                Authorization:
                    `Bearer ${apiKey}`,
            },
        );

    if (!response.ok) {
        return httpFailure(
            "xAI",
            reference.modelId,
            response.status,
        );
    }

    if (!isRecord(response.data)) {
        return malformedResponse(
            "xAI",
        );
    }

    return success(
        reference,
        "supported",
        stringValue(
            response.data.id,
        ),
    );
}

async function validateOpenRouter(
    apiKey: string,
    reference: CloudflareModelReference,
    fetchImpl: MetadataFetch,
): Promise<ProviderMetadataValidationResult> {
    /*
     * `/key` proves that the supplied credential itself is accepted. The model
     * catalog is then checked separately without invoking any model.
     */
    const keyResponse =
        await requestJson(
            fetchImpl,
            "https://openrouter.ai/api/v1/key",
            {
                Authorization:
                    `Bearer ${apiKey}`,
            },
        );

    if (!keyResponse.ok) {
        return httpFailure(
            "OpenRouter",
            reference.modelId,
            keyResponse.status,
        );
    }

    const modelResponse =
        await requestJson(
            fetchImpl,
            "https://openrouter.ai/api/v1/models",
            {
                Authorization:
                    `Bearer ${apiKey}`,
            },
        );

    if (
        !modelResponse.ok
    ) {
        return httpFailure(
            "OpenRouter",
            reference.modelId,
            modelResponse.status,
        );
    }

    if (
        !isRecord(
            modelResponse.data,
        ) ||
        !Array.isArray(
            modelResponse.data.data,
        )
    ) {
        return malformedResponse(
            "OpenRouter",
        );
    }

    const model =
        modelResponse.data.data.find(
            (entry) =>
                isRecord(entry) &&
                entry.id ===
                    reference.modelId,
        );

    if (!isRecord(model)) {
        return modelNotFound(
            "OpenRouter",
            reference.modelId,
        );
    }

    const architecture =
        isRecord(
            model.architecture,
        )
            ? model.architecture
            : undefined;

    if (
        Array.isArray(
            architecture
                ?.output_modalities,
        ) &&
        !architecture
            .output_modalities
            .includes(
                "text",
            )
    ) {
        return {
            ok: false,
            message:
                `O modelo '${reference.modelId}' existe no OpenRouter, mas não anuncia saída textual.`,
            code:
                "generation_unsupported",
        };
    }

    const parameters =
        Array.isArray(
            model.supported_parameters,
        )
            ? model
                .supported_parameters
                .filter(
                    (
                        value,
                    ): value is string =>
                        typeof value ===
                        "string",
                )
            : [];

    const structuredOutputSupport:
        StructuredOutputSupport =
        parameters.includes(
            "response_format",
        ) ||
        parameters.includes(
            "structured_outputs",
        )
            ? "supported"
            : "unknown";

    return success(
        reference,
        structuredOutputSupport,
        stringValue(
            model.name,
        ) ??
            stringValue(
                model.id,
            ),
    );
}

interface JsonRequestSuccess {
    readonly ok: true;
    readonly status: number;
    readonly data: unknown;
}

interface JsonRequestFailure {
    readonly ok: false;
    readonly status: number;
}

type JsonRequestResult =
    | JsonRequestSuccess
    | JsonRequestFailure;

async function requestJson(
    fetchImpl: MetadataFetch,
    url: string,
    headers: Readonly<Record<string, string>>,
): Promise<JsonRequestResult> {
    const response =
        await fetchImpl(
            url,
            {
                method:
                    "GET",
                headers: {
                    Accept:
                        "application/json",
                    ...headers,
                },
                signal:
                    AbortSignal.timeout(
                        10_000,
                    ),
            },
        );

    if (!response.ok) {
        return {
            ok: false,
            status:
                response.status,
        };
    }

    return {
        ok: true,
        status:
            response.status,
        data:
            await response.json(),
    };
}

function success(
    reference: CloudflareModelReference,
    structuredOutputSupport: StructuredOutputSupport,
    modelDisplayName?: string,
): ProviderMetadataValidationSuccess {
    return {
        ok: true,
        provider:
            reference.provider,
        model:
            reference.canonical,
        structuredOutputSupport,
        ...(modelDisplayName ===
        undefined
            ? {}
            : {
                modelDisplayName,
            }),
    };
}

function httpFailure(
    providerName: string,
    modelId: string,
    status: number,
): ProviderMetadataValidationFailure {
    switch (status) {
        case 401:
            return {
                ok: false,
                status,
                code:
                    "invalid_api_key",
                message:
                    `A API key foi rejeitada por ${providerName}.`,
            };

        case 403:
            return {
                ok: false,
                status,
                code:
                    "forbidden",
                message:
                    `A API key foi aceita por ${providerName}, mas não possui acesso ao recurso/modelo '${modelId}'.`,
            };

        case 404:
            return {
                ok: false,
                status,
                code:
                    "model_not_found",
                message:
                    `O modelo '${modelId}' não foi encontrado por ${providerName}.`,
            };

        case 429:
            return {
                ok: false,
                status,
                code:
                    "rate_limited",
                message:
                    `${providerName} recusou a verificação por rate limit. Nenhuma configuração foi salva.`,
            };

        default:
            return {
                ok: false,
                status,
                code:
                    `http_${status}`,
                message:
                    `${providerName} recusou a verificação de metadata (HTTP ${status}). Nenhuma inferência foi executada.`,
            };
    }
}

function modelNotFound(
    providerName: string,
    modelId: string,
): ProviderMetadataValidationFailure {
    return {
        ok: false,
        code:
            "model_not_found",
        message:
            `A API key foi aceita por ${providerName}, mas o modelo '${modelId}' não apareceu entre os modelos disponíveis para essa chave.`,
    };
}

function malformedResponse(
    providerName: string,
): ProviderMetadataValidationFailure {
    return {
        ok: false,
        code:
            "invalid_metadata_response",
        message:
            `${providerName} respondeu à verificação, mas o formato de metadata não era o esperado. A configuração não foi salva.`,
    };
}

function safeTransportError(
    error: unknown,
    apiKey: string,
    providerName: string,
): string {
    const raw =
        error instanceof Error
            ? error.message
            : String(error);

    const safe =
        raw
            .replaceAll(
                apiKey,
                "[REDACTED]",
            )
            .trim();

    return safe.length > 0
        ? `Falha ao consultar metadata de ${providerName}: ${safe}`
        : `Falha desconhecida ao consultar metadata de ${providerName}.`;
}

function stringValue(
    value: unknown,
): string | undefined {
    return typeof value ===
        "string" &&
        value.trim().length >
            0
        ? value
        : undefined;
}

function isRecord(
    value: unknown,
): value is Record<string, unknown> {
    return (
        typeof value ===
            "object" &&
        value !== null &&
        !Array.isArray(value)
    );
}
