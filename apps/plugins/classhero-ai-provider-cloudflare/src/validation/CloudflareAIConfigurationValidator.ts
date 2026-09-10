import {
    parseCloudflareModelReference,
    type MetadataValidatedProvider,
} from "../models/CloudflareModelReference.js";
import {
    validateProviderMetadata,
    type MetadataFetch,
    type StructuredOutputSupport,
} from "./ProviderMetadataValidators.js";

/** Values entered by the user before persistence. */
export interface CloudflareAIConfigurationInput {
    readonly accountId: string;
    readonly gatewayId: string;
    readonly gatewayToken?: string;
    readonly apiKey: string;
    readonly model: string;
}

/** Result of Cloudflare token/gateway validation without inference. */
export type CloudflareGatewayValidationMode =
    | "verified"
    | "token-verified-no-read-permission"
    | "not-verified-no-token";

/** Successful complete configuration validation. */
export interface CloudflareAIConfigurationValidationSuccess {
    readonly ok: true;
    readonly accountId: string;
    readonly gatewayId: string;
    readonly gatewayToken?: string;
    readonly model: string;
    readonly provider: MetadataValidatedProvider;
    readonly modelDisplayName?: string;
    readonly validationMode:
        "metadata-no-inference";
    readonly gatewayValidation:
        CloudflareGatewayValidationMode;
    readonly gatewayAuthentication?: boolean;
    readonly cloudflareTokenStatus?: "active";
    readonly structuredOutputSupport:
        StructuredOutputSupport;
}

/** Failed configuration validation. */
export interface CloudflareAIConfigurationValidationFailure {
    readonly ok: false;
    readonly message: string;
    readonly status?: number;
    readonly code?: string;
}

export type CloudflareAIConfigurationValidationResult =
    | CloudflareAIConfigurationValidationSuccess
    | CloudflareAIConfigurationValidationFailure;

export interface CloudflareAIConfigurationValidatorOptions {
    readonly fetch?: MetadataFetch;
}

type GatewayValidationResult =
    | {
        readonly ok: true;
        readonly mode:
            CloudflareGatewayValidationMode;
        readonly authentication?: boolean;
        readonly tokenStatus?: "active";
    }
    | CloudflareAIConfigurationValidationFailure;

type TokenVerificationResult =
    | {
        readonly ok: true;
        readonly status: "active";
    }
    | CloudflareAIConfigurationValidationFailure;

/**
 * Validates Cloudflare routing plus the upstream API key/model without
 * executing a model inference.
 *
 * When a Cloudflare API token is supplied the flow is:
 *
 * 1. GET /user/tokens/verify
 * 2. GET /accounts/:accountId/ai-gateway/gateways/:gatewayId
 * 3. validate upstream provider key/model through provider metadata
 *
 * The first request proves that the token itself is valid and active. This
 * lets the gateway metadata request safely distinguish a valid Run-only token
 * from an actually invalid token.
 */
export class CloudflareAIConfigurationValidator {
    private readonly fetchImpl:
        MetadataFetch;

    constructor(
        options:
            CloudflareAIConfigurationValidatorOptions =
                {},
    ) {
        this.fetchImpl =
            options.fetch ??
            globalThis.fetch;
    }

    async validate(
        input: CloudflareAIConfigurationInput,
    ): Promise<CloudflareAIConfigurationValidationResult> {
        const accountId =
            input.accountId.trim();

        const gatewayId =
            input.gatewayId.trim();

        const gatewayToken =
            input.gatewayToken
                ?.trim() ||
            undefined;

        const apiKey =
            input.apiKey.trim();

        const model =
            input.model.trim();

        if (!accountId) {
            return failure(
                "Informe o Cloudflare Account ID.",
                "missing_account_id",
            );
        }

        if (!gatewayId) {
            return failure(
                "Informe o AI Gateway ID.",
                "missing_gateway_id",
            );
        }

        if (!apiKey) {
            return failure(
                "A API key do provider não pode estar vazia.",
                "missing_provider_api_key",
            );
        }

        if (!model) {
            return failure(
                "O modelo não pode estar vazio.",
                "missing_model",
            );
        }

        const parsed =
            parseCloudflareModelReference(
                model,
            );

        if (!parsed.ok) {
            return parsed;
        }

        const gateway:
            GatewayValidationResult =
            gatewayToken ===
            undefined
                ? {
                    ok: true,
                    mode:
                        "not-verified-no-token",
                }
                : await validateCloudflareGateway(
                    this.fetchImpl,
                    accountId,
                    gatewayId,
                    gatewayToken,
                );

        if (!gateway.ok) {
            return gateway;
        }

        const metadata =
            await validateProviderMetadata(
                apiKey,
                parsed.reference,
                this.fetchImpl,
            );

        if (!metadata.ok) {
            return metadata;
        }

        return {
            ok: true,
            accountId,
            gatewayId,
            ...(gatewayToken ===
            undefined
                ? {}
                : {
                    gatewayToken,
                }),
            model:
                metadata.model,
            provider:
                metadata.provider,
            validationMode:
                "metadata-no-inference",
            gatewayValidation:
                gateway.mode,
            ...(gateway.authentication ===
            undefined
                ? {}
                : {
                    gatewayAuthentication:
                        gateway.authentication,
                }),
            ...(gateway.tokenStatus ===
            undefined
                ? {}
                : {
                    cloudflareTokenStatus:
                        gateway.tokenStatus,
                }),
            structuredOutputSupport:
                metadata
                    .structuredOutputSupport,
            ...(metadata.modelDisplayName ===
            undefined
                ? {}
                : {
                    modelDisplayName:
                        metadata
                            .modelDisplayName,
                }),
        };
    }
}

/**
 * Verifies the Cloudflare token first, then optionally inspects the gateway.
 *
 * Both operations are metadata/control-plane requests and execute no model.
 */
async function validateCloudflareGateway(
    fetchImpl: MetadataFetch,
    accountId: string,
    gatewayId: string,
    token: string,
): Promise<GatewayValidationResult> {
    const tokenVerification =
        await verifyCloudflareToken(
            fetchImpl,
            token,
        );

    if (!tokenVerification.ok) {
        return tokenVerification;
    }

    const gateway =
        await inspectCloudflareGateway(
            fetchImpl,
            accountId,
            gatewayId,
            token,
        );

    if (!gateway.ok) {
        return gateway;
    }

    return {
        ...gateway,
        tokenStatus:
            tokenVerification.status,
    };
}

/**
 * Official Cloudflare API-token verification endpoint.
 *
 * A successful HTTP request is not enough: the response must say
 * `success: true` and `result.status: "active"`.
 */
async function verifyCloudflareToken(
    fetchImpl: MetadataFetch,
    token: string,
): Promise<TokenVerificationResult> {
    let response:
        Response;

    try {
        response =
            await fetchImpl(
                "https://api.cloudflare.com/client/v4/user/tokens/verify",
                {
                    method:
                        "GET",
                    headers: {
                        Accept:
                            "application/json",
                        Authorization:
                            `Bearer ${token}`,
                    },
                    signal:
                        AbortSignal.timeout(
                            10_000,
                        ),
                },
            );
    } catch (error) {
        return {
            ok: false,
            code:
                "cloudflare_token_verify_transport_error",
            message:
                sanitizeError(
                    error,
                    token,
                    "Falha ao verificar o Cloudflare API Token",
                ),
        };
    }

    if (!response.ok) {
        return tokenHttpFailure(
            response.status,
        );
    }

    let payload:
        unknown;

    try {
        payload =
            await response.json();
    } catch {
        return failure(
            "A Cloudflare respondeu à verificação do token, mas retornou um JSON inválido.",
            "invalid_cloudflare_token_verify_response",
        );
    }

    if (
        !isRecord(payload) ||
        payload.success !==
            true ||
        !isRecord(
            payload.result,
        )
    ) {
        return failure(
            "A Cloudflare não confirmou o API Token como válido.",
            "cloudflare_token_not_verified",
        );
    }

    const status =
        payload.result.status;

    if (
        status !==
        "active"
    ) {
        return {
            ok: false,
            code:
                "cloudflare_token_not_active",
            message:
                typeof status ===
                    "string"
                    ? `O Cloudflare API Token existe, mas está com status '${status}'.`
                    : "O Cloudflare API Token não está ativo.",
        };
    }

    return {
        ok: true,
        status:
            "active",
    };
}

/**
 * Tries to verify account + gateway using Cloudflare's management API.
 *
 * A 403 is accepted only because the token has already been independently
 * verified as active. This covers a valid `AI Gateway Run` token without
 * `AI Gateway Read` permission.
 */
async function inspectCloudflareGateway(
    fetchImpl: MetadataFetch,
    accountId: string,
    gatewayId: string,
    token: string,
): Promise<GatewayValidationResult> {
    let response:
        Response;

    try {
        response =
            await fetchImpl(
                [
                    "https://api.cloudflare.com/client/v4/accounts",
                    encodeURIComponent(
                        accountId,
                    ),
                    "ai-gateway/gateways",
                    encodeURIComponent(
                        gatewayId,
                    ),
                ].join("/"),
                {
                    method:
                        "GET",
                    headers: {
                        Accept:
                            "application/json",
                        Authorization:
                            `Bearer ${token}`,
                    },
                    signal:
                        AbortSignal.timeout(
                            10_000,
                        ),
                },
            );
    } catch (error) {
        return {
            ok: false,
            code:
                "cloudflare_gateway_transport_error",
            message:
                sanitizeError(
                    error,
                    token,
                    "Falha ao consultar o AI Gateway da Cloudflare",
                ),
        };
    }

    if (!response.ok) {
        return gatewayHttpResult(
            response.status,
            gatewayId,
        );
    }

    let payload:
        unknown;

    try {
        payload =
            await response.json();
    } catch {
        return failure(
            "A Cloudflare respondeu ao teste do gateway, mas retornou um JSON inválido.",
            "invalid_cloudflare_gateway_response",
        );
    }

    if (
        !isRecord(payload) ||
        payload.success !==
            true ||
        !isRecord(
            payload.result,
        )
    ) {
        return failure(
            "A Cloudflare respondeu ao teste do gateway, mas o envelope da resposta não era o esperado.",
            "invalid_cloudflare_gateway_response",
        );
    }

    const id =
        payload.result.id;

    if (
        typeof id !==
            "string" ||
        id !==
            gatewayId
    ) {
        return failure(
            `O gateway retornado pela Cloudflare não corresponde a '${gatewayId}'.`,
            "cloudflare_gateway_mismatch",
        );
    }

    return {
        ok: true,
        mode:
            "verified",
        ...(typeof payload
            .result
            .authentication ===
        "boolean"
            ? {
                authentication:
                    payload.result
                        .authentication,
            }
            : {}),
    };
}

function tokenHttpFailure(
    status: number,
): CloudflareAIConfigurationValidationFailure {
    switch (status) {
        case 401:
            return {
                ok: false,
                status,
                code:
                    "invalid_cloudflare_token",
                message:
                    "O Cloudflare API Token foi rejeitado pelo endpoint oficial de verificação.",
            };

        case 403:
            return {
                ok: false,
                status,
                code:
                    "cloudflare_token_verify_forbidden",
                message:
                    "A Cloudflare não permitiu verificar esse API Token.",
            };

        case 429:
            return {
                ok: false,
                status,
                code:
                    "cloudflare_token_verify_rate_limited",
                message:
                    "A Cloudflare aplicou rate limit durante a verificação do API Token.",
            };

        default:
            return {
                ok: false,
                status,
                code:
                    `cloudflare_token_verify_http_${status}`,
                message:
                    `Não foi possível verificar o Cloudflare API Token (HTTP ${status}).`,
            };
    }
}

function gatewayHttpResult(
    status: number,
    gatewayId: string,
): GatewayValidationResult {
    switch (status) {
        case 401:
            /*
             * The token was already verified as active. A 401 here therefore
             * means the current token cannot authenticate this operation.
             */
            return {
                ok: false,
                status,
                code:
                    "cloudflare_gateway_unauthorized",
                message:
                    "O Cloudflare API Token é válido e ativo, mas não foi aceito ao consultar esse AI Gateway.",
            };

        case 403:
            /*
             * This is now safe to treat as a permission limitation because
             * `/user/tokens/verify` already proved the credential itself.
             */
            return {
                ok: true,
                mode:
                    "token-verified-no-read-permission",
            };

        case 404:
            return {
                ok: false,
                status,
                code:
                    "cloudflare_gateway_not_found",
                message:
                    `O AI Gateway '${gatewayId}' não foi encontrado nessa conta.`,
            };

        case 429:
            return {
                ok: false,
                status,
                code:
                    "cloudflare_gateway_rate_limited",
                message:
                    "A Cloudflare aplicou rate limit durante a validação do gateway.",
            };

        default:
            return {
                ok: false,
                status,
                code:
                    `cloudflare_gateway_http_${status}`,
                message:
                    `Não foi possível validar o AI Gateway '${gatewayId}' (HTTP ${status}).`,
            };
    }
}

function failure(
    message: string,
    code: string,
): CloudflareAIConfigurationValidationFailure {
    return {
        ok: false,
        message,
        code,
    };
}

function sanitizeError(
    error: unknown,
    secret: string,
    prefix: string,
): string {
    const raw =
        error instanceof Error
            ? error.message
            : String(error);

    const safe =
        raw
            .replaceAll(
                secret,
                "[REDACTED]",
            )
            .trim();

    return safe.length >
        0
        ? `${prefix}: ${safe}`
        : `${prefix}.`;
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
