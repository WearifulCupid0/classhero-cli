/** A generic object whose exact fields are not yet known. */
export type UnknownRecord = Record<string, unknown>;

/** Nullable string helper used by response contracts. */
export type StringNullable = string | null;

/** Nullable number helper used by response contracts. */
export type NumberNullable = number | null;

/** Nullable boolean helper used by response contracts. */
export type BooleanNullable = boolean | null;

/** Common `{ data: T }` envelope returned by several ClassHero endpoints. */
export interface ApiDataResponse<T> extends UnknownRecord {
    data: T;
    message?: string;
}

/** Common paginated `{ data: T[] }` response used by list endpoints. */
export interface ApiListResponse<T> extends UnknownRecord {
    data: T[];
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    total_pages?: number;
}

/** Common message response returned by several ClassHero endpoints. */
export interface GenericMessage extends UnknownRecord {
    message: string;
}

/** Error payload shape observed across ClassHero API responses. */
export interface ApiErrorBody extends UnknownRecord {
    message?: string;
    error?: string | {
        message?: string;
        code?: string;
        [key: string]: unknown;
    };
    code?: string;
}

/** Tokens maintained by the ClassHero transport. */
export interface TokenSet {
    accessToken?: string | undefined;
    refreshToken?: string | undefined;
    accessTokenVm?: string | undefined;
    refreshTokenVm?: string | undefined;
}
