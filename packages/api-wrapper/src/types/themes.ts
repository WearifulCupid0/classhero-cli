import type { StringNullable, UnknownRecord } from "./common.js";

/** Mission/theme metadata returned for a course. */
export interface Theme extends UnknownRecord {
    id: string;
    title: string;
    description: string;
    order: number;
    badge_title: string;
    badge_slug: string;
    badge_image_url: string;
    badge_image_prompt: string;
    bonus_start_date: string;
    bonus_full_weight_end_date: string;
    bonus_final_date: string;
    is_published: boolean;
    has_material_accesses: boolean;
    discipline_id: StringNullable;
    course_id: string;
    rationale: string;
    mapped_objectives: string[];
    tags: string[];
    continuous_enrollment: boolean;
    has_proposal: boolean;
    has_mission_materials: boolean;
    materials_count: number;
    materials_draft_count: number;
}

/** Response returned by `/themes/by-course/:courseId`. */
export interface ThemesByCourseResponse extends UnknownRecord {
    data: Theme[];
    serverTime: string;
}

/** Student mission closure/checkpoint state. */
export interface ThemeClosure extends UnknownRecord {
    theme_id: string;
    student_email: string;
    status: string;
    understood_text: StringNullable;
    doubts_text: StringNullable;
    application_text: StringNullable;
    question_text: StringNullable;
    checkpoint_responses: UnknownRecord | unknown[] | null;
    submitted_at: StringNullable;
}

/** Individualized bonus dates returned for continuous enrollment missions. */
export interface ThemeBonusDates extends UnknownRecord {
    bonus_start_date?: StringNullable;
    bonus_full_weight_end_date?: StringNullable;
    bonus_final_date?: StringNullable;
}
