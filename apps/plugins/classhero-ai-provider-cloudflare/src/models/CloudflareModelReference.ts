/**
 * Providers for which this plugin can validate API key + model without running
 * a paid/usage-bearing model inference.
 *
 * Cloudflare AI Gateway supports more providers than this list; unsupported
 * prefixes are rejected during configuration until a reliable authenticated
 * metadata check exists for them.
 */
export type MetadataValidatedProvider =
    | "openai"
    | "anthropic"
    | "google"
    | "groq"
    | "deepseek"
    | "mistral"
    | "grok"
    | "openrouter";

/** Parsed and normalized Cloudflare Unified model reference. */
export interface CloudflareModelReference {
    readonly provider: MetadataValidatedProvider;
    readonly modelId: string;
    readonly canonical: string;
}

/** Failed model-reference parsing. */
export interface InvalidCloudflareModelReference {
    readonly ok: false;
    readonly message: string;
}

/** Successful model-reference parsing. */
export interface ValidCloudflareModelReference {
    readonly ok: true;
    readonly reference: CloudflareModelReference;
}

export type CloudflareModelReferenceResult =
    | ValidCloudflareModelReference
    | InvalidCloudflareModelReference;

/**
 * Parses a `provider/model` model id accepted by the Cloudflare Unified API.
 *
 * Aliases normalized here:
 * - `google-ai-studio/*` -> `google/*`
 * - `xai/*` -> `grok/*`
 *
 * OpenRouter intentionally keeps the whole nested model id after its prefix,
 * e.g. `openrouter/openai/gpt-5-mini`.
 */
export function parseCloudflareModelReference(
    value: string,
): CloudflareModelReferenceResult {
    const normalized =
        value.trim();

    const separator =
        normalized.indexOf("/");

    if (
        separator <= 0 ||
        separator ===
            normalized.length - 1
    ) {
        return {
            ok: false,
            message:
                "Informe o modelo no formato 'provider/model', por exemplo 'openai/gpt-5.2'.",
        };
    }

    const rawProvider =
        normalized
            .slice(
                0,
                separator,
            )
            .trim()
            .toLowerCase();

    let modelId =
        normalized
            .slice(
                separator + 1,
            )
            .trim();

    if (!modelId) {
        return {
            ok: false,
            message:
                "O id do modelo não pode estar vazio.",
        };
    }

    const provider =
        normalizeProvider(
            rawProvider,
        );

    if (!provider) {
        return {
            ok: false,
            message: [
                `O prefixo '${rawProvider}' ainda não possui validação sem inferência neste provider.`,
                "Use openai, anthropic, google, groq, deepseek, mistral, grok/xai ou openrouter.",
            ].join(" "),
        };
    }

    if (
        provider === "google" &&
        modelId.startsWith(
            "models/",
        )
    ) {
        modelId =
            modelId.slice(
                "models/".length,
            );
    }

    if (
        modelId.length === 0 ||
        /\s/.test(modelId)
    ) {
        return {
            ok: false,
            message:
                "O id do modelo não pode estar vazio nem conter espaços.",
        };
    }

    const canonicalProvider =
        provider === "grok"
            ? "grok"
            : provider;

    return {
        ok: true,
        reference: {
            provider,
            modelId,
            canonical:
                `${canonicalProvider}/${modelId}`,
        },
    };
}

function normalizeProvider(
    provider: string,
): MetadataValidatedProvider | undefined {
    switch (provider) {
        case "openai":
        case "anthropic":
        case "google":
        case "groq":
        case "deepseek":
        case "mistral":
        case "grok":
        case "openrouter":
            return provider;

        case "google-ai-studio":
            return "google";

        case "xai":
            return "grok";

        default:
            return undefined;
    }
}
