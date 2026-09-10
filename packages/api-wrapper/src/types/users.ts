import type { StringNullable, UnknownRecord } from "./common.js";

/** Avatar record embedded in user payloads. */
export interface UserAvatar extends UnknownRecord {
    avatar_url: string;
    is_active: boolean;
}

/** One upcoming hero level shown in the student's profile. */
export interface HeroUpcomingLevel extends UnknownRecord {
    level: number;
    level_label: string;
    rank: string;
    xp_min: number;
    xp_remaining: number;
}

/** XP/level summary returned together with a ClassHero user. */
export interface HeroProfile extends UnknownRecord {
    xp_total: number;
    assignments_xp: number;
    badges_total: number;
    level: number;
    level_label: string;
    rank: string;
    title_base: string;
    title_effective: string;
    progress_to_next_level_pct: number;
    next_level_label: string;
    upcoming_levels: HeroUpcomingLevel[];
}

/** Availability counter for one generated hero identity resource. */
export interface HeroGenerationAllowance extends UnknownRecord {
    used: boolean;
    remaining: number;
    available: boolean;
}

/** Hero generation limits exposed in the user profile response. */
export interface HeroGenerationStatus extends UnknownRecord {
    current_level: number;
    limited_by_level: boolean;
    hero_name: HeroGenerationAllowance;
    hero_avatar: HeroGenerationAllowance;
    hero_title: HeroGenerationAllowance;
}

/** User profile returned by `/users/by-email` and related endpoints. */
export interface User extends UnknownRecord {
    name: string;
    email: string;
    github_url?: StringNullable;
    avatar?: StringNullable;
    show_real_identity?: boolean;
    hero_name?: StringNullable;
    hero_class?: StringNullable;
    hero_gender?: StringNullable;
    hero_avatar_url?: StringNullable;
    hero_avatar_tags?: unknown[] | null;
    hero_visual_family?: StringNullable;
    hero_visual_variant?: number | null;
    hero_visual_stage?: number | null;
    hero_visual_seed?: StringNullable;
    hero_visual_version?: number | null;
    hero_title_custom?: StringNullable;
    hero_title_source?: StringNullable;
    hero_last_generated_at?: StringNullable;
    hero_persona_version?: number | null;
    is_a_admin: boolean;
    is_a_teacher: boolean;
    is_a_student: boolean;
    is_validated: boolean;
    is_visitor?: boolean;
    is_tester_eligible?: boolean;
    tester_eligible_until?: StringNullable;
    tester_mode_enabled?: boolean;
    must_change_temporary_password?: boolean;
    temporary_password_issued_at?: StringNullable;
    temporary_password_used_at?: StringNullable;
    password_configured_at?: StringNullable;
    password_tip_dismissed_at?: StringNullable;
    created_at?: string;
    updated_at?: string;
    last_access_at?: StringNullable;
    last_seen_product_updates_at?: StringNullable;
    users_avatars?: UserAvatar[] | UserAvatar | null;
    hero_profile?: HeroProfile;
    hero_generation_status?: HeroGenerationStatus;
}

/** Payload accepted by the general profile update route. */
export interface UpdateUserInfoInput {
    email?: string;
    employer?: string | null;
    github_url?: string | null;
    name?: string;
    occupation?: string | null;
    show_real_identity?: boolean;
}

/** Payload used by the administrative user e-mail action. */
export interface SendEmailInput {
    target_email: string;
    subject: string;
    message: string;
}

/** Hero level-up notification state. */
export interface HeroLevelUpNotice extends UnknownRecord {
    level_up: boolean;
    level: number;
    title_available: boolean;
}

/** One course that can fund hero-avatar generation through pedagogical credits. */
export interface HeroAvatarCreditCourse extends UnknownRecord {
    course_id: string;
    course_name: string;
    available_credits: number;
}

/** Credit context returned before generating/changing a hero avatar. */
export interface HeroAvatarCreditContext extends UnknownRecord {
    cost: number;
    courses: HeroAvatarCreditCourse[];
}

/** A historical hero identity entry. The captures supplied an empty list, so extra fields remain open. */
export interface HeroIdentityHistoryEntry extends UnknownRecord {
    id?: string;
    created_at?: string;
    hero_name?: StringNullable;
    hero_class?: StringNullable;
    hero_title?: StringNullable;
    hero_avatar_url?: StringNullable;
}
