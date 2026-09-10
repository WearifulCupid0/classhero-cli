import type { StringNullable, UnknownRecord } from "./common.js";

/** Discipline metadata returned by the discipline lookup used by the web client. */
export interface Discipline extends UnknownRecord {
    id?: string;
    discipline_id?: string;
    name?: string;
    title?: string;
    acronym?: string;
    sigla?: string;
    description?: StringNullable;
}
