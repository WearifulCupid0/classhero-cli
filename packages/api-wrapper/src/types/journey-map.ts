import type { UnknownRecord } from "./common.js";

export type JourneyMediaKind = "opening" | "closing";

export interface JourneyStoredAsset extends UnknownRecord {
    size_bytes?: number;
    content_type?: string;
    storage_path?: string;
    original_filename?: string;
}

export interface JourneyTeacherImagePosition extends UnknownRecord {
    x_percent?: number;
    y_percent?: number;
    scale_percent?: number;
}

export interface JourneyMapSettings extends UnknownRecord {
    generated_by?: string;
    opening_video?: JourneyStoredAsset;
    closing_video?: JourneyStoredAsset;
    opening_teacher_image?: JourneyStoredAsset;
    closing_teacher_image?: JourneyStoredAsset;
    opening_teacher_image_position?: JourneyTeacherImagePosition;
    closing_teacher_image_position?: JourneyTeacherImagePosition;
}

/**
 * Relation between one Journey Map source resource and a related executable
 * target.
 *
 * The complete HAR confirms `practice_for_pdf` relations from a
 * `mission_material` PDF to separate `theme_material` targets such as
 * `gamified_quiz` and `games`.
 */
export interface JourneyTargetRelation extends UnknownRecord {
    relation: string;
    evidence_count?: number;
    source_target_id: string;
    related_target_id: string;
    source_target_type: string;
    related_target_type: string;
    source_target_scope: string;
    related_target_scope: string;
}

export interface JourneyMapGenerationMetadata extends UnknownRecord {
    source?: string;
    contract_version?: string;
    target_relations?: JourneyTargetRelation[];
    consolidation_targets?: UnknownRecord[];
    mission_consolidation_targets?: UnknownRecord[];
    background_image_prompt?: string;
    background_generation?: UnknownRecord;
}

export interface JourneyMapValidationResult extends UnknownRecord {
    valid: boolean;
    errors: unknown[];
    warnings: unknown[];
    covered_target_ids: string[];
    missing_target_ids: string[];
}

export interface JourneyUnlockRule extends UnknownRecord {
    prerequisite_node_keys?: string[];
}

/** One game/mode progress entry embedded in an associated `games` action. */
export interface JourneyAssociatedGameProgress extends UnknownRecord {
    game_key: string;
    mode: string;
    xp_earned: number;
    xp_possible: number;
    completed: boolean;
    attempt_id?: string;
}

/**
 * Student-specific progress for one action attached to a Journey Map resource.
 */
export interface JourneyAssociatedAction extends UnknownRecord {
    target_type: string;
    target_id: string;
    is_required: boolean;
    started: boolean;
    completed: boolean;
    xp_earned: number;
    xp_possible: number;

    /** Quiz-like progress fields. */
    approved_total?: number;
    attempt_total?: number;
    answered_total?: number;
    pending_total?: number;

    /** Mini-game progress fields. */
    completed_total?: number;
    max_total?: number;
    score?: number;
    game_progress?: JourneyAssociatedGameProgress[];
}

export interface JourneyMapNode extends UnknownRecord {
    node_id: string;
    journey_map_id: string;
    node_key: string;
    title: string;
    description: string;
    node_kind: string;
    target_scope: string;
    target_type: string;
    target_id: string;
    target_route_payload: UnknownRecord;
    xp_policy: string;
    unlock_rule: JourneyUnlockRule;
    reward_config: UnknownRecord;
    visual_config: UnknownRecord;
    x_percent: number;
    y_percent: number;
    order_index: number;
    is_optional: boolean;
    created_at: string;
    updated_at: string;
    completion_policy: unknown | null;
    associated_actions?: JourneyAssociatedAction[];
    state?: string;
}

export interface JourneyMapDefinition extends UnknownRecord {
    journey_map_id: string;
    theme_id: string;
    status: string;
    source: string;
    title: string;
    summary: string;
    background_image_url: string;
    background_storage_path: string;
    background_width: number;
    background_height: number;
    settings: JourneyMapSettings;
    generation_metadata: JourneyMapGenerationMetadata;
    created_by: string;
    published_by: string;
    published_at: string;
    archived_at: string | null;
    created_at: string;
    updated_at: string;
    version: number;
    reviewed_by: string;
    reviewed_at: string;
    validation_status: string;
    validation_result: JourneyMapValidationResult;
    published_version: number;
    background_image_source: string;
    background_image_prompt: string;
    nodes: JourneyMapNode[];
}

export interface JourneyMapResponse extends UnknownRecord {
    data: JourneyMapDefinition;
}

export interface JourneyProgressState extends UnknownRecord {
    started: boolean;
    completed: boolean;
    xp_earned?: number;
    xp_possible?: number;
    associated_actions?: JourneyAssociatedAction[];
}

export interface JourneyMapProgress extends UnknownRecord {
    mission_proposal?: JourneyProgressState;
    initial_mind_map?: JourneyProgressState;
    pdf_analysis_art?: JourneyProgressState;
    pdf_conceptual_models?: JourneyProgressState;
    gamified_path?: JourneyProgressState;
    final_concept_map?: JourneyProgressState;
    mission_reflection?: JourneyProgressState;
    [key: string]: JourneyProgressState | unknown;
}

export interface JourneyMapProgressResponse extends UnknownRecord {
    data: JourneyMapProgress;
}

export interface JourneyMapSession extends UnknownRecord {
    last_node_key: string;
}

export interface JourneyMapSessionResponse extends UnknownRecord {
    data: JourneyMapSession;
}

export interface JourneyVideoProgressEntry extends UnknownRecord {
    current_position_seconds: number;
    max_watched_seconds: number;
    duration_seconds: number;
    watched_percentage: number;
    completed?: boolean;
}

export interface JourneyVideoStatus extends UnknownRecord {
    opening: string;
    closing: string;
    last_kind: JourneyMediaKind | string;
    progress: Partial<Record<JourneyMediaKind, JourneyVideoProgressEntry>> & UnknownRecord;
}

export interface JourneyVideoStatusResponse extends UnknownRecord {
    data: JourneyVideoStatus;
}

export interface UpdateJourneyVideoProgressInput extends UnknownRecord {
    current_position_seconds: number;
    max_watched_seconds: number;
    duration_seconds: number;
    watched_percentage: number;
    completed?: boolean;
}

export interface JourneyNodeCompletion extends UnknownRecord {
    node_key: string;
    completed: boolean;
}

export interface JourneyNodeCompletionResponse extends UnknownRecord {
    data: JourneyNodeCompletion;
}

export interface JourneyPedagogicalCreditsBalance extends UnknownRecord {
    availableCredits: number;
}

export interface JourneyPedagogicalCreditsResponse extends UnknownRecord {
    data: JourneyPedagogicalCreditsBalance;
}

export interface JourneyMapUpsertInput extends UnknownRecord {
    journey_map_id?: string;
    title?: string;
    summary?: string;
    background_image_url?: string;
    background_image_source?: string;
    background_image_prompt?: string;
    background_storage_path?: string;
    background_width?: number;
    background_height?: number;
    settings?: JourneyMapSettings;
    generation_metadata?: JourneyMapGenerationMetadata;
    nodes?: Array<JourneyMapNode | UnknownRecord>;
}

export interface JourneyBackgroundGenerateInput extends UnknownRecord {
    prompt?: string;
}

export interface JourneyBackgroundPreview extends UnknownRecord {
    preview_id?: string;
    image_url?: string;
}

export interface JourneyBackgroundAcceptInput {
    preview_id: string;
}
