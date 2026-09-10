import type { StringNullable, UnknownRecord } from "./common.js";

/** Discipline entry nested inside `/classes/my-disciplines`. */
export interface StudentDiscipline extends UnknownRecord {
    class_discipline_id: string;
    discipline_id: StringNullable;
    name: string;
    teacher_name: StringNullable;
    url_image: StringNullable;
    description: StringNullable;
    student_count: number;
    material_count: number;
    course_name: StringNullable;
    course_acronym?: StringNullable;
    acronym?: StringNullable;
    course_id: StringNullable;
}

/** Student class and the disciplines currently linked to it. */
export interface StudentClass extends UnknownRecord {
    class_id: string;
    code: string;
    year?: number;
    semester?: number;
    end_date?: StringNullable;
    disciplines: StudentDiscipline[];
}

/** Class-discipline contract used by the dedicated lookup endpoint. */
export interface ClassDiscipline extends UnknownRecord {
    id?: string;
    class_discipline_id?: string;
    discipline_id?: string | null;
    name?: string;
    discipline_name?: string;
    acronym?: string;
    discipline_acronym?: string;
    sigla?: string;
    teacher_name?: string | null;
}
