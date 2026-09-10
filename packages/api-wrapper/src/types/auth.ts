import type { GenericMessage, UnknownRecord } from "./common.js";

/** Minimal user representation returned by authentication endpoints. */
export interface AuthenticatedUser extends UnknownRecord {
    email: string;
    name: string;
    is_a_teacher: boolean;
    is_a_admin: boolean;
    is_validated: boolean;
    is_a_student: boolean;
    is_visitor?: boolean;
    avatar?: string | null;
    github_url?: string | null;
    last_access_at?: string | null;
    show_real_identity?: boolean;
    hero_name?: string | null;
    hero_class?: string | null;
    hero_gender?: string | null;
    hero_avatar_url?: string | null;
    must_change_temporary_password?: boolean;
}

/** Authentication response used by code and password login flows. */
export interface AuthResponse extends UnknownRecord {
    access_token: string;
    refresh_token: string;
    access_token_vm?: string;
    refresh_token_vm?: string;
    message?: string;
    user: AuthenticatedUser;
}

/** Impersonation metadata exposed by `/auth/session` when applicable. */
export interface ImpersonationData extends UnknownRecord {
    admin_email: string;
    target_email: string;
    impersonated_at: string;
}

/** Current ClassHero authentication session. */
export interface AuthSession extends UnknownRecord {
    authenticated: boolean;
    exp?: number;
    ttl?: number;
    is_impersonating?: boolean;
    impersonation_data?: ImpersonationData | null;
}

/** Response returned when administrator impersonation is stopped. */
export interface StopImpersonateResponse extends GenericMessage {
    admin_email?: string;
}

/** Payload accepted by the email-code login request. */
export interface SendCodeRequest {
    email: string;
}

/** Payload accepted by code verification. */
export interface VerifyCodeRequest {
    email: string;
    code: string;
}

/** Payload accepted by password login. */
export interface PasswordLoginRequest {
    email: string;
    password: string;
}

/** Payload accepted by password setup. */
export interface SetPasswordRequest {
    password: string;
}
