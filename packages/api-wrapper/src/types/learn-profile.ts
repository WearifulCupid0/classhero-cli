import type { UnknownRecord } from "./common.js";

export type LearnProfileState = "not_started" | "in_progress" | "completed" | "stale" | (string & {});

export interface LearnProfileStatus extends UnknownRecord {
    state: LearnProfileState;
    canStartNewApplication: boolean;
    canRetake: boolean;
    isStale: boolean;
    currentVersion: number;
    inProgressApplicationId: string | null;
    latestSubmittedAt: string | null;
}

export interface LearnProfileBand extends UnknownRecord {
    min: number;
    max: number;
}

export interface LearnProfileQuestionnaireConfig extends UnknownRecord {
    bands: Record<string, LearnProfileBand>;
    rules: string[];
    stale_after_days: number;
    instrument_status: string;
    retake_cooldown_days: number;
    min_answered_items_per_dimension: number;
}

export interface LearnProfileDimension extends UnknownRecord {
    id: string;
    key: string;
    group_key: string;
    name: string;
    description: string;
    student_description: string;
    sort_order: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface LearnProfileOptionWeight extends UnknownRecord {
    id: string;
    option_id: string;
    dimension_id: string;
    weight: number;
    rationale: string;
    created_at: string;
    updated_at: string;
}

export interface LearnProfileQuestionOption extends UnknownRecord {
    id: string;
    question_id: string;
    value: string;
    label: string;
    sort_order: number;
    created_at: string;
    updated_at: string;
    weights: LearnProfileOptionWeight[];
}

export interface LearnProfileQuestion extends UnknownRecord {
    id: string;
    version_id: string;
    section_id: string;
    key: string;
    prompt: string;
    help_text: string | null;
    response_type: string;
    required: boolean;
    reverse_presentation: boolean;
    sort_order: number;
    created_at: string;
    updated_at: string;
    options: LearnProfileQuestionOption[];
}

export interface LearnProfileSection extends UnknownRecord {
    id: string;
    version_id: string;
    key: string;
    title: string;
    description: string;
    sort_order: number;
    created_at: string;
    updated_at: string;
    questions: LearnProfileQuestion[];
}

export interface LearnProfileQuestionnaire extends UnknownRecord {
    instrumentId: string;
    versionId: string;
    version: number;
    title: string;
    introText: string;
    completionText: string;
    scoringAlgorithmKey: string;
    scoringAlgorithmVersion: number;
    config: LearnProfileQuestionnaireConfig;
    dimensions: LearnProfileDimension[];
    sections: LearnProfileSection[];
}

export interface CreateLearnProfileApplicationInput extends UnknownRecord {
    source: string;
}

export interface LearnProfileApplicationAnswer extends UnknownRecord {
    questionId: string;
    optionId: string;
    answeredAt?: string | null;
}

export interface LearnProfileApplication extends UnknownRecord {
    id: string;
    status?: string;
    source?: string;
    answeredCount?: number;
    answers?: LearnProfileApplicationAnswer[];
    createdAt?: string;
    submittedAt?: string | null;
}

export interface UpdateLearnProfileAnswerInput {
    questionId: string;
    optionId: string;
}

export interface UpdateLearnProfileAnswerResponse extends UnknownRecord {
    answeredCount?: number;
}

export interface LearnProfileScore extends UnknownRecord {
    dimension_id: string;
    score?: number;
    band?: string;
}

export interface LearnProfileCurrent extends UnknownRecord {
    scores?: LearnProfileScore[];
    version?: number;
    submittedAt?: string;
}

export interface LearnProfileTeacherSummaryQuery {
    course_id?: string;
    class_discipline_id?: string;
}

export interface LearnProfileTeacherSummary extends UnknownRecord {
    students?: UnknownRecord[];
    dimensions?: UnknownRecord[];
}

export type LearnProfileTeacherStudent = UnknownRecord;
export type LearnProfileAdminStudent = UnknownRecord;
