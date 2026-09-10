import { Api } from "../client/Api.js";
import type { ApiRequestOptions } from "../client/types.js";

/** Escape hatch for API routes that do not yet have a dedicated typed facade. */
export class Raw extends Api {
    get<T>(path: string, options: Omit<ApiRequestOptions, "method"> = {}) {
        return this.request<T>(path, { ...options, method: "GET" });
    }

    post<T>(path: string, body?: unknown, options: Omit<ApiRequestOptions, "method" | "body"> = {}) {
        return this.request<T>(path, {
            ...options,
            method: "POST",
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
    }

    patch<T>(path: string, body?: unknown, options: Omit<ApiRequestOptions, "method" | "body"> = {}) {
        return this.request<T>(path, {
            ...options,
            method: "PATCH",
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
    }

    put<T>(path: string, body?: unknown, options: Omit<ApiRequestOptions, "method" | "body"> = {}) {
        return this.request<T>(path, {
            ...options,
            method: "PUT",
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
    }

    delete<T>(path: string, options: Omit<ApiRequestOptions, "method"> = {}) {
        return this.request<T>(path, { ...options, method: "DELETE" });
    }
}
