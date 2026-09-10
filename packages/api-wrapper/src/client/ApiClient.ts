import { CLASSHERO_API_URL } from "../constants.js";
import type { AuthResponse } from "../types/auth.js";
import type { ApiErrorBody, TokenSet } from "../types/common.js";
import type { ApiClientOptions, ApiRequestOptions, ApiResponse } from "./types.js";

function isJsonContentType(value: string | null): boolean {
    return value !== null && (value.includes("application/json") || value.includes("+json"));
}

function isFormData(value: BodyInit | null | undefined): value is FormData {
    return typeof FormData !== "undefined" && value instanceof FormData;
}

function normalizeBaseUrl(baseUrl: string): string {
    return baseUrl.replace(/\/+$/, "");
}

function mergeCookie(existing: string | null, name: string, value: string): string {
    const cookies = (existing ?? "")
        .split(";")
        .map((item) => item.trim())
        .filter(Boolean)
        .filter((item) => !item.startsWith(`${name}=`));

    cookies.push(`${name}=${value}`);

    return cookies.join("; ");
}

/**
 * Low-level HTTP transport shared by every API domain.
 *
 * The client owns authentication tokens, injects the regular bearer token,
 * mirrors the VM access token through the cookie observed in the web client,
 * and serializes the retry required after an authentication refresh.
 */
export class ApiClient {
    readonly baseUrl: string;
    readonly autoRefresh: boolean;
    readonly sendVmCookie: boolean;

    private readonly fetchImpl: typeof globalThis.fetch;
    private readonly defaultHeaders: Headers;
    private tokens: TokenSet;
    private refreshPromise: Promise<boolean> | null = null;

    constructor(options: ApiClientOptions = {}) {
        this.baseUrl = normalizeBaseUrl(options.baseUrl ?? CLASSHERO_API_URL);
        this.autoRefresh = options.autoRefresh ?? true;
        this.sendVmCookie = options.sendVmCookie ?? true;
        this.fetchImpl = options.fetch ?? globalThis.fetch;
        this.defaultHeaders = new Headers(options.defaultHeaders);
        this.tokens = {
            accessToken: options.accessToken,
            refreshToken: options.refreshToken,
            accessTokenVm: options.accessTokenVm,
            refreshTokenVm: options.refreshTokenVm,
        };

        if (typeof this.fetchImpl !== "function") {
            throw new Error("Nenhuma implementação de fetch foi encontrada. Use Node.js 22+ ou informe options.fetch.");
        }
    }

    getTokens(): Readonly<TokenSet> {
        return { ...this.tokens };
    }

    setTokens(tokens: TokenSet): void {
        this.tokens = { ...this.tokens, ...tokens };
    }

    setTokensFromAuth(response: Partial<AuthResponse>): void {
        this.setTokens({
            accessToken: response.access_token,
            refreshToken: response.refresh_token,
            accessTokenVm: response.access_token_vm,
            refreshTokenVm: response.refresh_token_vm,
        });
    }

    clearTokens(): void {
        this.tokens = {};
    }

    resolveUrl(path: string): string {
        if (/^https?:\/\//i.test(path)) {
            return path;
        }

        return `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    }

    private isSameApiOrigin(url: string): boolean {
        try {
            return new URL(url).origin === new URL(this.baseUrl).origin;
        } catch {
            return false;
        }
    }

    private createHeaders(options: ApiRequestOptions, tokenOverride?: string): Headers {
        const headers = new Headers(this.defaultHeaders);

        new Headers(options.headers).forEach((value, key) => headers.set(key, value));

        if (!headers.has("Accept")) {
            headers.set("Accept", "application/json");
        }

        const bearer = tokenOverride ?? this.tokens.accessToken;
        if (bearer && !headers.has("Authorization")) {
            headers.set("Authorization", `Bearer ${bearer}`);
        }

        const vmToken = tokenOverride ?? this.tokens.accessTokenVm;
        const canSetCookie = typeof window === "undefined";
        if (this.sendVmCookie && canSetCookie && vmToken) {
            headers.set("Cookie", mergeCookie(headers.get("Cookie"), "sb-access-token-vm", vmToken));
        }

        if (options.body != null && !isFormData(options.body) && !headers.has("Content-Type")) {
            headers.set("Content-Type", "application/json");
        }

        return headers;
    }

    private async fetchOnce(
        path: string,
        options: ApiRequestOptions = {},
        tokenOverride?: string,
    ): Promise<Response> {
        const { tryRefreshOn401: _tryRefreshOn401, ...requestOptions } = options;
        const url = this.resolveUrl(path);
        const headers = this.createHeaders(options, tokenOverride);

        if (!this.isSameApiOrigin(url)) {
            headers.delete("Authorization");
            headers.delete("Cookie");
        }

        return this.fetchImpl(url, {
            ...requestOptions,
            headers,
            credentials: requestOptions.credentials ?? "include",
            cache: requestOptions.cache ?? "no-store",
        });
    }

    async raw(
        path: string,
        options: ApiRequestOptions = {},
        tokenOverride?: string,
    ): Promise<Response> {
        const tryRefresh = options.tryRefreshOn401 ?? this.autoRefresh;
        const first = await this.fetchOnce(path, options, tokenOverride);

        if (first.status !== 401 || !tryRefresh || tokenOverride) {
            return first;
        }

        if (path.includes("/auth/refresh-token")) {
            return first;
        }

        const refreshed = await this.refreshAuthentication();
        if (!refreshed) {
            return first;
        }

        return this.fetchOnce(path, { ...options, tryRefreshOn401: false }, tokenOverride);
    }

    async request<T>(
        path: string,
        options: ApiRequestOptions = {},
        tokenOverride?: string,
    ): Promise<ApiResponse<T>> {
        const raw = await this.raw(path, options, tokenOverride);
        const contentType = raw.headers.get("content-type");
        let body: unknown;

        if (raw.status === 204 || raw.status === 205) {
            body = undefined;
        } else if (isJsonContentType(contentType)) {
            body = await raw.json().catch(() => undefined);
        } else {
            const text = await raw.text();

            if (!text.length) {
                body = undefined;
            } else {
                try {
                    body = JSON.parse(text);
                } catch {
                    body = text;
                }
            }
        }

        return {
            ok: raw.ok,
            status: raw.status,
            statusText: raw.statusText,
            response: body as T,
            headers: raw.headers,
        };
    }

    async requestOrThrow<T>(
        path: string,
        options: ApiRequestOptions = {},
        tokenOverride?: string,
    ): Promise<T> {
        const result = await this.request<T | ApiErrorBody>(path, options, tokenOverride);

        if (result.ok) {
            return result.response as T;
        }

        const errorBody = result.response as ApiErrorBody | string | undefined;
        const message = typeof errorBody === "string"
            ? errorBody
            : errorBody?.message
                ?? (typeof errorBody?.error === "string" ? errorBody.error : errorBody?.error?.message)
                ?? `ClassHero respondeu com HTTP ${result.status}`;

        throw new Error(message);
    }

    async download(
        path: string,
        options: ApiRequestOptions = {},
        tokenOverride?: string,
    ): Promise<ApiResponse<Uint8Array>> {
        const raw = await this.raw(path, options, tokenOverride);
        const buffer = new Uint8Array(await raw.arrayBuffer());

        return {
            ok: raw.ok,
            status: raw.status,
            statusText: raw.statusText,
            response: buffer,
            headers: raw.headers,
        };
    }

    async refreshAuthentication(): Promise<boolean> {
        if (this.refreshPromise) {
            return this.refreshPromise;
        }

        const refreshToken = this.tokens.refreshToken;
        const refreshTokenVm = this.tokens.refreshTokenVm ?? refreshToken;

        if (!refreshToken && !refreshTokenVm) {
            return false;
        }

        this.refreshPromise = (async () => {
            try {
                const body: Record<string, string> = {};

                if (refreshToken) {
                    body.refresh_token = refreshToken;
                }

                if (refreshTokenVm) {
                    body.refresh_token_vm = refreshTokenVm;
                }

                const result = await this.request<AuthResponse>("/auth/refresh-token", {
                    method: "POST",
                    body: JSON.stringify(body),
                    tryRefreshOn401: false,
                });

                if (!result.ok || !result.response) {
                    return false;
                }

                this.setTokensFromAuth(result.response);

                return true;
            } catch {
                return false;
            } finally {
                this.refreshPromise = null;
            }
        })();

        return this.refreshPromise;
    }
}
