import { Api, createQuery } from "../client/Api.js";
import type { ClassDiscipline, StudentClass } from "../types/index.js";

/** Class and class-discipline operations. */
export class Classes extends Api {
    myDisciplines(includeArchived = false) {
        return this.request<StudentClass[]>(`/classes/my-disciplines${createQuery({ includeArchived })}`);
    }

    classDiscipline(classDisciplineId: string) {
        return this.request<ClassDiscipline | { discipline?: ClassDiscipline; data?: ClassDiscipline }>(
            `/class-disciplines/${encodeURIComponent(classDisciplineId)}`,
        );
    }
}
