import type { PedagogicalCreditAward } from "./games.js";
import type { UnknownRecord } from "./common.js";

/** Quiz difficulty/level ids observed in the ClassHero client. */
export type QuizLevel =
    | "basic"
    | "intermediate"
    | "advanced"
    | "mixed"
    | (string & {});

/**
 * Student-facing quiz question types observed in the complete quiz HAR.
 *
 * The open string branch preserves forward compatibility with new backend
 * question types while allowing executors to explicitly reject unknown ones.
 */
export type QuizQuestionType =
    | "true_false"
    | "multiple_choice"
    | "multiple_select"
    | "fill_in_blank"
    | "matching"
    | "ordering"
    | "short_answer"
    | "single_select"
    | "association"
    | (string & {});

export interface QuizOption extends UnknownRecord {
    label: string;
    text: string;
}

export interface QuizAttemptQuestionState extends UnknownRecord {
    is_answered: boolean;
    status: string;
}

export interface QuizRevealedHint extends UnknownRecord {
    hint_id?: string;
    position?: number;
    text?: string;
    content?: string;
}

export interface QuizHintState extends UnknownRecord {
    available: boolean;
    revealed_count: number;
    max_hints: number;
    next_cost: number | null;
    balance: number | null;
    has_more: boolean;
    revealed_hints: QuizRevealedHint[];
}

export interface QuizAnswerRevealState extends UnknownRecord {
    available?: boolean;
    revealed?: boolean;
    cost?: number;
    balance?: number | null;
    answer?: unknown;
}

/**
 * Full question JSON returned by
 * `/quizzes/attempts/:attemptId/questions/:questionId/json`.
 */
export interface QuizQuestion extends UnknownRecord {
    question_id: string;
    material_type: string;
    question: string;
    type: QuizQuestionType;
    level: QuizLevel;
    /** Empty before answering in the captured student flow. */
    correct_answers: string[];
    options: QuizOption[];
    extra: unknown | null;
    source_paragraphs: string[];
    theme_mission_material_id: string | null;
    source_material_title: string | null;
    attempt_question: QuizAttemptQuestionState;
    question_xp_possible: number;
    num_correct_options?: number | null;
    hint_state: QuizHintState;
    answer_reveal_state?: QuizAnswerRevealState;
}

export interface QuizQuestionJsonResponse extends UnknownRecord {
    question_json: QuizQuestion;
}

export interface QuizAttempt extends UnknownRecord {
    quiz_attempt_id: string;
    student_email?: string;
    material_id: string;
    started_at: string;
    finished_at: string | null;
    status: string;
    last_access_at?: string;
    score?: number;
    score_correct?: number | null;
    score_avg_time?: number | null;
    score_total_time?: number | null;
    final_score?: number | null;
    violation_count?: number;
    violation_penalty_pct?: number;
    updated_at?: string;
    level: QuizLevel;
    theme_mission_material_id: string;
}

export interface PendingQuizQuestion extends UnknownRecord {
    question_id: string;
    status: string;
    order_index: number;
}

export interface ActiveQuizAttemptResponse extends UnknownRecord {
    attempt: QuizAttempt | null;
    pending_questions: PendingQuizQuestion[];
}

export interface ReviewQuizQuestion extends UnknownRecord {
    attempt_id: string;
    question_id: string;
    order_index: number;
    title: string;
    score: number | null;
}

export interface LatestFinishedQuizAttemptResponse extends UnknownRecord {
    attempt: QuizAttempt | null;
    review_questions: ReviewQuizQuestion[];
}

export interface ActiveQuizAttemptQuery {
    level?: QuizLevel;
    all_available?: boolean;
    quantity?: number;
    theme_mission_material_id?: string;
}

export interface LatestFinishedQuizAttemptQuery {
    theme_mission_material_id?: string;
}

/**
 * Body observed when creating a quiz attempt.
 *
 * The web client serializes `all_available` and `quantity` as strings.
 */
export interface StartQuizAttemptInput extends UnknownRecord {
    material_id: string;
    theme_id: string;
    theme_mission_material_id: string;
    level: QuizLevel;
    all_available?: boolean | "true" | "false";
    quantity?: number | string;
}

/** Question metadata returned immediately after creating an attempt. */
export interface StartedQuizQuestion extends UnknownRecord {
    question_id: string;
    question: string;
    type: QuizQuestionType;
    level: QuizLevel;
    /** Ordering field observed in the complete quiz HAR. */
    order: number;
    /** Older/alternate shape retained for compatibility. */
    order_index?: number;
    status?: string;
}

export interface StartQuizAttemptResponse extends UnknownRecord {
    attempt_id: string;
    started_at: string;
    questions: StartedQuizQuestion[];
}

export interface UpdateQuizAttemptInput {
    last_access_at: string;
}

export interface UpdateQuizAttemptResponse extends UnknownRecord {
    success: boolean;
}

/**
 * Answer update body observed in the browser.
 *
 * `started_at` is the attempt start timestamp for every question; the
 * per-question elapsed time is carried separately by
 * `question_duration_seconds`.
 */
export interface QuizAttemptQuestionUpdateInput extends UnknownRecord {
    attempt_id: string;
    question_id: string;
    status: "answered" | (string & {});
    is_answered: boolean;
    answer: string[];
    answered_at: string;
    question_duration_seconds: number;
    started_at: string;
}

export interface QuizAttemptQuestionUpdateResponse extends UnknownRecord {
    success: boolean;
    message?: string;
}

export interface QuizAttemptQuestionValidateInput {
    attempt_id: string;
    question_id: string;
}

/**
 * Dynamic evaluator payload returned for semantic and deterministic question
 * types. Exact subfields vary by question type.
 */
export interface QuizQuestionEvaluation extends UnknownRecord {
    score?: number;
    recommendedScore?: number;
    recommended_score?: number;
    quality?: string;
    pedagogical_status?: string;
    evaluation_status?: string;
    reasoning?: string;
    student_feedback?: string;
}

/**
 * Validation response observed across fill-in-blank, true/false, matching,
 * multi-select, short-answer and multiple-choice questions.
 */
export interface QuizAttemptQuestionValidateResponse extends UnknownRecord {
    evaluation: QuizQuestionEvaluation | null;
    evaluationStatus: string;
    explanation: string;
    extra: unknown | null;
    guidanceOnError: string;
    guidanceOnSuccess: string;
    questionXp: number;
    technicalFailure: boolean;
    correctAnswers?: string[];
    isCorrect?: boolean;
    pedagogical_credit_award?: PedagogicalCreditAward | null;

    /** Legacy/alternate response fields retained for compatibility. */
    status?: string;
    score?: number;
    question_xp?: number;
    feedback?: UnknownRecord;
}

export interface QuizPreviewValidationInput {
    question_id: string;
    answer: string[];
}

export type QuizPreviewValidationResponse =
    QuizAttemptQuestionValidateResponse;

export interface QuizCreditBalance extends UnknownRecord {
    available_credits?: number;
}

export interface QuizHintRevealResponse extends UnknownRecord {
    hint?: QuizRevealedHint;
    hint_state?: Partial<QuizHintState>;
    balance?: QuizCreditBalance;
}

export interface QuizAnswerRevealResponse extends UnknownRecord {
    answer?: unknown;
    answer_reveal_state?: QuizAnswerRevealState;
    balance?: QuizCreditBalance;
}

export interface QuizReopenQuestion extends UnknownRecord {
    question_id: string;
    question?: string;
}

export interface QuizReopenResponse extends UnknownRecord {
    attempt_id?: string;
    started_at?: string;
    question_id?: string;
    questions?: QuizReopenQuestion[];
    available_credits?: number;
    reversed_xp?: number;
}

export interface QuizViolationInput extends UnknownRecord {
    violation_type: string;
    question_id: string;
    user_confirmed: boolean;
}

export interface QuizViolationResponse extends UnknownRecord {
    success?: boolean;
    violation_count?: number;
    violation_penalty_pct?: number;
}

export interface QuizScoreResponse extends UnknownRecord {
    score?: number;
    final_score?: number;
    score_correct?: number;
    score_avg_time?: number;
    score_total_time?: number;
}

export interface CreateQuizContestInput {
    quiz_attempt_id: string;
    question_id: string;
    message: string;
}

export interface CreateQuizContestResponse extends UnknownRecord {
    id?: string;
    success?: boolean;
    message?: string;
}

export interface QuizContest extends UnknownRecord {
    id?: string;
    quiz_attempt_id?: string;
    question_id?: string;
    status?: string;
    message?: string;
}

export interface QuizContestsMineQuery {
    page?: number;
    limit?: number;
}

export interface QuizContestsMineResponse extends UnknownRecord {
    data: QuizContest[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
