import type { TokenSet } from "../types/common.js";

/** Parsed HTTP response returned by the API wrapper. */
export interface ApiResponse<T> {
    ok: boolean;
    status: number;
    statusText: string;
    response: T;
    headers: Headers;
}

/** Options used to construct an {@link ApiClient}. */
export interface ApiClientOptions extends TokenSet {
    baseUrl?: string;
    autoRefresh?: boolean;
    defaultHeaders?: HeadersInit;
    fetch?: typeof globalThis.fetch;
    sendVmCookie?: boolean;
}

/** Request options understood by the ClassHero transport. */
export interface ApiRequestOptions extends RequestInit {
    /** Whether one automatic authentication refresh should be attempted after HTTP 401. */
    tryRefreshOn401?: boolean;
}
