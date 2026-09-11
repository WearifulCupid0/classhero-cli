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
    closure_id?: string;
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


/**
 * Mission-closure payload accepted by the student closure endpoint.
 *
 * The fifth HAR directly observes `{ status: "waived" }`; the text/checkpoint
 * fields mirror the closure record already returned by the same resource.
 */
export interface ThemeClosureSubmission extends UnknownRecord {
    status: string;
    understood_text?: StringNullable;
    doubts_text?: StringNullable;
    application_text?: StringNullable;
    question_text?: StringNullable;
    checkpoint_responses?: UnknownRecord | unknown[] | null;
}

/**
 * Bonus/evaluation data for a submitted mission closure.
 *
 * The fifth HAR confirms the endpoint but its response body was not preserved,
 * so the structure intentionally stays forward-compatible.
 */
export interface ThemeClosureEvaluationRubricItem extends UnknownRecord {
    score?: number;
    feedback?: string;
}

export interface ThemeClosureEvaluationRubric extends UnknownRecord {
    question_quality?: ThemeClosureEvaluationRubricItem;
    honesty_of_doubts?: ThemeClosureEvaluationRubricItem;
    practical_application?: ThemeClosureEvaluationRubricItem;
    understanding_quality?: ThemeClosureEvaluationRubricItem;
}

export interface ThemeClosureEvaluationAiRubric extends UnknownRecord {
    rubric?: ThemeClosureEvaluationRubric;
    strengths?: string[];
    improvements?: string[];
    teacher_summary?: string;
}

export interface ThemeClosureEvaluationFlags extends UnknownRecord {
    empty?: boolean;
    off_topic?: boolean;
    low_effort?: boolean;
    prompt_injection?: boolean;
}

/** Student reflection evaluation observed in `/themes/:id/closure/evaluation`. */
export interface ThemeClosureEvaluation extends UnknownRecord {
    evaluation_id: string;
    closure_id: string;
    theme_id: string;
    course_id: string;
    ai_status: string;
    ai_score: number | null;
    ai_bonus_value: number | null;
    ai_quality_level: string | null;
    ai_feedback: unknown;
    ai_rubric: ThemeClosureEvaluationAiRubric | null;
    ai_flags: ThemeClosureEvaluationFlags | null;
    teacher_status: string | null;
    teacher_bonus_value: number | null;
    teacher_comment: string | null;
    reviewed_by: string | null;
    reviewed_at: string | null;
    bonus_entry_id: string | null;
    submission_attempt: number;
    supersedes_evaluation_id: string | null;
    is_current: boolean;
    created_at: string;
    updated_at: string;
}

export interface ThemeClosureEvaluationResponse extends UnknownRecord {
    data: ThemeClosureEvaluation | null;
}

/** Fully filled reflection payload sent when the student submits manually or with AI assistance. */
export interface SubmittedThemeClosureInput extends UnknownRecord {
    status: "submitted";
    understood_text: string;
    doubts_text: string;
    application_text: string;
    question_text: string;
}
