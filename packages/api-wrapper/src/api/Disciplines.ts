import { Api } from "../client/Api.js";
import type { Discipline } from "../types/index.js";

/** Discipline metadata operations. */
export class Disciplines extends Api {
    byId(disciplineId: string) {
        return this.request<Discipline>(`/disciplines/${encodeURIComponent(disciplineId)}`);
    }
}
