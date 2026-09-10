import type { UnknownRecord } from "./common.js";

export interface XpSummary extends UnknownRecord {
    xp_materials: number;
    xp_quizzes: number;
    xp_games: number;
    xp_bonus_additional: number;
    xp_interactive_path: number;
    xp_live_session: number;
    xp_bonus: number;
    xp_assignments: number;
    xp_total: number;
}

export interface XpCard extends UnknownRecord {
    class_id: string | null;
    class_discipline_id: string | null;
    course_id: string;
    discipline_name: string | null;
    show_grades: boolean;
    grade_weight_assignments: number;
    grade_weight_other_xp: number;
    xp_material_earned: number;
    xp_quiz_earned: number;
    xp_assignment_earned: number;
    xp_assignment_count: number;
    xp_assignment_base: number;
    xp_leader_without_assignments: number;
    xp_earned: number;
    xp_games: number;
    xp_bonus_additional: number;
    xp_interactive_path: number;
    xp_live_session: number;
    xp_bonus: number;
    xp_bonus_total: number;
    bonus_total: number;
    xp_total: number;
    other_xp: number;
    quiz_xp: number;
    total_xp: number;
    assessment_configured: boolean;
    assessment_xp_percent: number;
    assessment_categories: UnknownRecord[];
    assessment_grades: Record<string, number>;
    user_position: number;
}

export interface XpCardsResponse extends UnknownRecord {
    data: XpCard[];
}

export interface XpBreakdown extends UnknownRecord {
    xp_materials: number;
    xp_quizzes: number;
    xp_games_bonus: number;
    xp_bonus_additional: number;
    xp_assignments: number;
    xp_interactive_path: number;
    xp_live_session: number;
    xp_course_asset_video_bonus: number;
    xp_teacher_video: number;
    xp_missions_total: number;
    xp_extras_outside_missions: number;
    xp_missions_source: string;
    xp_missions_header_source: string;
    xp_missions_raw_view_total: number;
    xp_missions_header_total: number;
    xp_missions_game_bonus_total: number;
    xp_missions_complementary_total: number;
    xp_missions_teacher_video_total: number;
    xp_missions_access_floor_total: number;
    xp_missions_missing_access_floor_total: number;
}

export interface XpDisciplineTotal extends UnknownRecord {
    xp_total: number;
    xp_breakdown: XpBreakdown;
    bonus_total?: number;
}

export interface XpMission extends UnknownRecord {
    theme_id: string;
    mission_title: string;
    materials_total: number;
    materials_total_all: number;
    materials_finished: number;
    mission_xp: number;
    mission_xp_possible: number;
    already_rewarded: boolean;
    rewarded_at: string | null;
    mission_bonus_xp: number;
    mission_activity_xp: number;
    mission_activity_xp_possible: number;
    mission_other_xp: number;
}

export interface XpMissionsDebugBreakdown extends UnknownRecord {
    source: string;
    header_source: string;
    raw_view_total: number;
    header_total: number;
    game_bonus_total: number;
    complementary_total: number;
    teacher_video_total: number;
    access_floor_total: number;
    final_total: number;
}

export interface XpMissionsResponse extends UnknownRecord {
    total_xp: number;
    xp_possible: number;
    missions: XpMission[];
    debug_breakdown: XpMissionsDebugBreakdown;
    assignments_count: number;
    assignments_xp_earned: number;
    assignments_xp_possible: number;
    missions_xp: number;
    missions_xp_possible: number;
}

export interface RankingProfileItem extends UnknownRecord {
    slot_key?: string;
    metadata?: UnknownRecord;
}

export interface RankingEntry extends UnknownRecord {
    __normalized_email?: string;
    student_email?: string;
    student_name?: string;
    hero_name?: string;
    hero_class?: string | null;
    hero_title_custom?: string | null;
    avatar_url?: string | null;
    real_name?: string | null;
    real_avatar_url?: string | null;
    show_real_identity?: boolean;
    github_url?: string | null;
    class_id?: string | null;
    class_discipline_id?: string | null;
    discipline_id?: string | null;
    course_id?: string | null;
    discipline_name?: string | null;
    student_identifier: string;
    display_name: string;
    has_hero_name: boolean;
    is_current_user: boolean;
    quiz_xp: number;
    other_xp: number;
    xp_bonus_material: number;
    xp_bonus_theme: number;
    xp_interactive_path_earned?: number;
    xp_assignment_earned: number;
    xp_course_asset_video?: number;
    total_xp: number;
    profile_background_url?: string | null;
    profile_frame_item?: RankingProfileItem | null;
    profile_aura_item?: RankingProfileItem | null;
    hero_accessory_item?: RankingProfileItem | null;
    hero_neck_accessory_item?: RankingProfileItem | null;
    hero_additional_accessory_items?: RankingProfileItem[];
    seed_index?: number;
    materials_finished?: number;
    position?: number;
}

export interface RankingBulkResponse extends UnknownRecord {
    data: RankingEntry[];
    title?: string;
    description?: string;
    timestamp?: string;
}

export interface RankingMissionResponse extends UnknownRecord {
    ranking: RankingEntry[];
    viewer_position: number | null;
}

export interface NotifyMissingHeroNamesInput {
    course_id: string;
    student_identifiers: string[];
}

export interface NotifyMissingHeroNamesResponse extends UnknownRecord {
    ok: boolean;
}

export interface XpRefreshData extends UnknownRecord {
    courseIds: string[];
    invalidatedKeys: string[];
}

export interface XpRefreshResponse extends UnknownRecord {
    success: boolean;
    message: string;
    data: XpRefreshData;
}

export interface XpPositionResponse extends UnknownRecord {
    position?: number;
}

export interface RankingRecalculateResponse extends UnknownRecord {
    message?: string;
    success?: boolean;
}
