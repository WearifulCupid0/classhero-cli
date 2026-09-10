import { ApiClient } from "./ApiClient.js";
import type { ApiRequestOptions, ApiResponse } from "./types.js";

/** Base class used by the domain-specific API facades. */
export class Api {
    constructor(protected readonly client: ApiClient = new ApiClient()) {}

    request<T>(path: string, options: ApiRequestOptions = {}, token?: string): Promise<ApiResponse<T>> {
        return this.client.request<T>(path, options, token);
    }

    raw(path: string, options: ApiRequestOptions = {}, token?: string): Promise<Response> {
        return this.client.raw(path, options, token);
    }

    download(path: string, options: ApiRequestOptions = {}, token?: string): Promise<ApiResponse<Uint8Array>> {
        return this.client.download(path, options, token);
    }

    requestOrThrow<T>(path: string, options: ApiRequestOptions = {}, token?: string): Promise<T> {
        return this.client.requestOrThrow<T>(path, options, token);
    }
}

/** Builds a query string while omitting nullish and empty-string values. */
export function createQuery(params: Record<string, string | number | boolean | null | undefined>): string {
    const search = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === "") {
            continue;
        }

        search.set(key, String(value));
    }

    const result = search.toString();

    return result ? `?${result}` : "";
}

/** Appends a Blob to FormData only when it is defined. */
export function appendBlob(form: FormData, field: string, blob: Blob | undefined, filename?: string): void {
    if (!blob) {
        return;
    }

    if (filename) {
        form.append(field, blob, filename);
    } else {
        form.append(field, blob);
    }
}
