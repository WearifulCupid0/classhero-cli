import type { GenericMessage, NumberNullable, StringNullable, UnknownRecord } from "./common.js";

/** AI-generation switches embedded in several material configurations. */
export interface MaterialGenerationConfig extends UnknownRecord {
    generateInstructions: boolean;
    generateName: boolean;
    generateDescription: boolean;
    generateContent?: boolean;
    additionalInstructions?: string;
    audioFocus?: string;
    videoFocus?: string;
}

/** Level configuration used by assignment/gamified quiz material modes. */
export interface MaterialLevelConfig extends UnknownRecord {
    max_xp: number;
    enabled: boolean;
    question_count: number;
    question_types: string[];
    distribution?: {
        basic?: number;
        intermediate?: number;
        advanced?: number;
        [key: string]: number | undefined;
    };
}

/** Multi-level configuration shared by assignment and gamified quiz settings. */
export interface MaterialLevelsConfig extends UnknownRecord {
    levels: {
        basic?: MaterialLevelConfig;
        intermediate?: MaterialLevelConfig;
        advanced?: MaterialLevelConfig;
        mixed?: MaterialLevelConfig;
        [key: string]: MaterialLevelConfig | undefined;
    };
}

/** Question configured for a synchronous/session material. */
export interface MaterialSessionQuestion extends UnknownRecord {
    id: string;
    title: string;
    prompt: string;
    teacher_answer: string;
}

/** Session configuration embedded in a material. */
export interface MaterialSessionConfig extends UnknownRecord {
    title: string;
    format: string;
    enabled: boolean;
    questions: MaterialSessionQuestion[];
    intro_text: string;
    prompt_text: string;
}

/** Student session state embedded in material progress. */
export interface MaterialSessionState extends UnknownRecord {
    eligible: boolean;
    reason: string;
    run_status: StringNullable;
    opens_at: StringNullable;
    closes_at: StringNullable;
    opened_at: StringNullable;
    closed_at: StringNullable;
    has_participated: boolean;
    participation: UnknownRecord | null;
    revealed_question_ids: string[];
}

/** Complete student-facing material/progress record observed in `/theme-materials/by-theme/:id`. */
export interface ThemeMaterial extends UnknownRecord {
    material_id: string;
    theme_id: string;
    type: string;
    title: string;
    description: string;
    content: string;
    created_at: string;
    updated_at: string;
    order: number;
    youtube_pt_url: string;
    youtube_en_url: string;
    teacher_video_url: string;
    teacher_video_enabled: boolean;
    is_enable: boolean;
    preparation_enabled: boolean;
    code_challenge_language: StringNullable;
    notebook_lm_config: MaterialGenerationConfig;
    assignment_config: MaterialLevelsConfig | null;
    complementary_resources: UnknownRecord[];
    session_config: MaterialSessionConfig;
    external_video_min_watch_seconds: NumberNullable;
    gamified_quiz_xp_config: MaterialLevelsConfig | null;
    pdf_ai_config: MaterialGenerationConfig;
    assignment: UnknownRecord | null;
    finished_flag: boolean | null;
    xp_base: number;
    xp_earned: NumberNullable;
    xp_bonus: number;
    xp_bonus_complementary: number;
    xp_bonus_theme: number;
    bonus_multiplier: number;
    xp_penalty: number;
    attempt_number: number;
    attempt_multiplier: number;
    xp_base_raw: number;
    card_display_xp_earned: NumberNullable;
    card_display_xp_possible: NumberNullable;
    activities_base_xp_possible: NumberNullable;
    extras_xp_possible: NumberNullable;
    activities_base_xp_earned: NumberNullable;
    extras_xp_earned: NumberNullable;
    access_xp_possible: NumberNullable;
    access_xp_earned: NumberNullable;
    answer_xp_possible: NumberNullable;
    answer_xp_earned: NumberNullable;
    teacher_video_xp_possible: NumberNullable;
    teacher_video_xp_earned: NumberNullable;
    game_xp_possible: NumberNullable;
    game_xp_earned: NumberNullable;
    complementary_xp_possible: NumberNullable;
    complementary_xp_earned: NumberNullable;
    support_text_xp_possible: NumberNullable;
    support_text_xp_earned: NumberNullable;
    checkout_xp_possible: NumberNullable;
    checkout_xp_earned: NumberNullable;
    study_plan_required: boolean;
    study_plan_xp_possible: NumberNullable;
    study_plan_xp_earned: NumberNullable;
    assignment_xp_possible: NumberNullable;
    assignment_xp_earned: NumberNullable;
    attempt_penalty_xp: NumberNullable;
    lateness_penalty_xp: NumberNullable;
    integrity_penalty_xp: NumberNullable;
    total_penalty_xp: NumberNullable;
    access_total_penalty_xp: NumberNullable;
    teacher_video_total_penalty_xp: NumberNullable;
    answer_total_penalty_xp: NumberNullable;
    support_text_total_penalty_xp: NumberNullable;
    checkout_total_penalty_xp: NumberNullable;
    study_plan_total_penalty_xp: NumberNullable;
    xp_possible_total: NumberNullable;
    score_accepted_for_game: boolean;
    score_accepted_for_game_at: StringNullable;
    accepted_score: NumberNullable;
    has_attempts: boolean;
    answered: boolean;
    best_score: NumberNullable;
    violation_count: number;
    violation_penalty_pct: number;
    alreadyRewarded: boolean;
    games_all_non_study_modes_completed?: boolean;
    support_text_read?: boolean;
    support_text_completed_effective?: boolean;
    checkout_completed?: boolean;
    checkout_submitted?: boolean;
    checkout_completed_effective?: boolean;
    study_plan_submitted?: boolean;
    study_plan_waived?: boolean;
    study_plan_completed_effective?: boolean;
    study_plan_evaluated?: boolean;
    sp_xp_amount?: number;
    sp_xp_granted?: boolean;
    interactive_path_step_xp_total?: number;
    interactive_path_completion_bonus_xp?: number;
    interactive_path_game_bonus_xp?: number;
    interactive_path_max_xp_total?: number;
    interactive_path_has_active_attempt?: boolean;
    interactive_path_completed_attempts?: number;
    interactive_path_last_attempt_xp?: number;
    interactive_path_last_attempt_number?: number;
    interactive_path_last_attempt_status?: StringNullable;
    interactive_path_best_attempt_xp?: number;
    interactive_path_best_attempt_number?: number;
    interactive_path_min_xp_to_block_retry?: number;
    interactive_path_retry_blocked_by_goal?: boolean;
    gamified_interactive_path_levels?: string[];
    gamified_interactive_path_enabled_levels?: string[];
    gamified_interactive_path_active_levels?: string[];
    gamified_interactive_path_finished_levels?: string[];
    gamified_interactive_path_total_xp?: number;
    gamified_interactive_path_possible_xp?: number;
    gamified_interactive_path_finished?: boolean;
    gamified_interactive_path_level_xp_map?: Record<string, number>;
    code_challenge_gamified_levels?: string[];
    code_challenge_gamified_enabled_levels?: string[];
    code_challenge_gamified_finished_levels?: string[];
    code_challenge_gamified_total_xp?: number;
    code_challenge_gamified_possible_xp?: number;
    code_challenge_gamified_finished?: boolean;
    code_challenge_gamified_challenge_total?: number;
    code_challenge_gamified_answered_total?: number;
    code_challenge_gamified_seen_total?: number;
    code_challenge_gamified_challenge_xp_map?: Record<string, number>;
    code_challenge_gamified_level_xp_map?: Record<string, number>;
    teacher_video_watched?: boolean;
    teacher_video_watched_effective?: boolean;
    teacher_video_xp_amount?: number;
    tester_access_override?: boolean;
    tester_video_override?: boolean;
    tester_support_text_override?: boolean;
    tester_game_override?: boolean;
    tester_response_override?: boolean;
    tester_checkout_override?: boolean;
    tester_study_plan_override?: boolean;
    tester_assignment_override?: boolean;
    is_tester_eligible?: boolean;
    tester_eligible_until?: StringNullable;
    tester_mode_enabled?: boolean;
    preparation_status?: string;
    preparation_acknowledged_at?: StringNullable;
    preparation_submitted_at?: StringNullable;
    preparation_waived_at?: StringNullable;
    preparation_updated_at?: StringNullable;
    session_state?: MaterialSessionState;
}

/** Lightweight mission material returned by `/themes/:themeId/mission-materials`. */
export interface MissionMaterial extends UnknownRecord {
    theme_mission_material_id: string;
    theme_id: string;
    title: string;
    type: string;
    url: string;
    description: string;
    order: number;
    offers_xp_bonus: boolean;
    updated_at: string;
    brain_markdown_url: string;
    exclude_from_ai_processing: boolean;
}

/** Availability state of the accessibility-adapted markdown for a material. */
export interface AdaptiveBrainMarkdownAvailability extends UnknownRecord {
    available: boolean;
    activityOptOut: boolean;
    dispensedForMaterial: boolean;
    needsLabels: string[];
    hasExistingAdaptation: boolean;
}

/** Markdown content generated for a mission material. */
export interface BrainMarkdown extends UnknownRecord {
    content: string;
    title: string;
}

/** Material access-session creation payload. */
export interface CreateMaterialAccessSessionInput {
    access_type: string;
}

/** Material access-session creation response. */
export interface CreateMaterialAccessSessionResponse extends UnknownRecord {
    session_id: string;
}

/** Material access-session update payload. */
export interface UpdateMaterialAccessSessionInput {
    duration_seconds: number;
    pages_viewed: number;
}

/** Generic feedback payload used by interactive path activities. */
export interface ThemeMaterialFeedbackInput {
    attemptId: string;
    stepId: string;
    message: string;
    idempotencyKey?: string;
    attachment?: Blob;
    filename?: string;
}

/** Feedback payload used by the gamified code challenge. */
export interface CodeChallengeFeedbackInput {
    materialId: string;
    attemptId: string;
    submissionId: string;
    message: string;
    idempotencyKey?: string;
    attachment?: Blob;
    filename?: string;
}

/** Payload that starts/resumes a gamified interactive path attempt. */
export interface StartGamifiedInteractivePathInput {
    level_key: string;
    material_id: string;
    mode: string;
}

/** One step in a gamified interactive path. */
export interface GamifiedInteractivePathStep extends UnknownRecord {
    hints: unknown[];
    title: string;
    prompt: string;
    path_id: string;
    payload: UnknownRecord;
    step_id: string;
    position: number;
    step_type: string;
    xp_reward: number;
    answer_key: unknown | null;
    created_at: string;
    updated_at: string;
    is_checkpoint: boolean;
    penalty_on_error: number;
    flashcard_back_text: StringNullable;
    flashcard_front_text: StringNullable;
    flashcard_code_snippet: StringNullable;
}

/** Gamified interactive path definition. */
export interface GamifiedInteractivePath extends UnknownRecord {
    path_id: string;
    material_id: string;
    theme_id: string;
    level_key: string;
    version: number;
    status: string;
    estimated_minutes: number;
    settings: UnknownRecord;
    summary: {
        title: string;
        description: string;
        [key: string]: unknown;
    };
    source: string;
    generation_metadata: UnknownRecord;
    created_by: string;
    published_at: StringNullable;
    archived_at: StringNullable;
    created_at: string;
    updated_at: string;
    steps: GamifiedInteractivePathStep[];
}

/** Student attempt state for a gamified interactive path. */
export interface GamifiedInteractivePathAttempt extends UnknownRecord {
    attempt_id: string;
    path_id: string;
    material_id: string;
    theme_id: string;
    level_key: string;
    student_email: string;
    status: string;
    attempt_number: number;
    started_at: string;
    completed_at: StringNullable;
    last_step_position: number;
    total_steps: number;
    correct_steps: number;
    wrong_steps: number;
    total_xp_awarded: number;
    completion_bonus_awarded: number;
    awarded_as_first_completion: boolean;
    metadata: UnknownRecord;
    created_at: string;
    updated_at: string;
}

/** Response returned when a gamified path attempt starts or resumes. */
export interface StartGamifiedInteractivePathResponse extends UnknownRecord {
    review_mode: boolean;
    resumed_attempt: boolean;
    attempt: GamifiedInteractivePathAttempt;
    path: GamifiedInteractivePath;
    path_xp_possible: number;
    step_attempts: UnknownRecord[];
}

/** Payload submitted for one gamified interactive path step. */
export interface SubmitGamifiedInteractivePathStepInput {
    answer_payload: UnknownRecord | string | number | boolean | unknown[] | null;
    attempt_id: string;
    hints_used: number;
    step_id: string;
}

/** Result of one gamified interactive path step. */
export interface SubmitGamifiedInteractivePathStepResponse extends UnknownRecord {
    attempt_id: string;
    step_id: string;
    status: string;
    xp_awarded: number;
    total_xp_awarded: number;
    resolved_steps: number;
    wrong_steps: number;
    correct_answer_display: string;
    correct_order_values: unknown[];
    completed_lesson: boolean;
    next_step_position: number;
}

/** Pedagogical-credit balance attached to an interactive path attempt. */
export interface InteractivePathCreditBalance extends UnknownRecord {
    available_credits: number;
}

/** Common response type for feedback endpoints. */
export type ThemeMaterialFeedbackResponse = GenericMessage | UnknownRecord;
