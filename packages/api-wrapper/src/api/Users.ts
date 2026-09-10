import { Api, appendBlob, createQuery } from "../client/Api.js";
import type {
    ApiDataResponse,
    GenericMessage,
    HeroAvatarCreditContext,
    HeroIdentityHistoryEntry,
    HeroLevelUpNotice,
    SendEmailInput,
    UpdateUserInfoInput,
    User,
} from "../types/index.js";

/** Student/user profile operations used by the ClassHero web client. */
export class Users extends Api {
    byEmail(email: string) {
        return this.request<ApiDataResponse<User>>(`/users/by-email${createQuery({ email })}`);
    }

    /** Resolves the currently authenticated user through the empty-email behavior used by the web client. */
    me() {
        return this.request<ApiDataResponse<User> | User>("/users/by-email?email=");
    }

    byIdentifier(identifier: string) {
        return this.request<ApiDataResponse<User>>(`/users/by-identifier${createQuery({ identifier })}`);
    }

    streamAvatar(input: { key?: string; url?: string } = {}) {
        return this.download(`/users/avatar/stream${createQuery(input)}`);
    }

    updateInfo(input: UpdateUserInfoInput) {
        return this.request<GenericMessage>("/users/update-info", {
            method: "PATCH",
            body: JSON.stringify(input),
        });
    }

    updateProfile(name: string) {
        return this.request<ApiDataResponse<User> | User>("/users/me/profile", {
            method: "PATCH",
            body: JSON.stringify({ name }),
        });
    }

    uploadAvatar(file: Blob, filename?: string) {
        const form = new FormData();
        appendBlob(form, "file", file, filename);

        return this.request<ApiDataResponse<User> | User>("/users/me/avatar", {
            method: "POST",
            body: form,
        });
    }

    heroLevelUpNotice() {
        return this.request<HeroLevelUpNotice>("/users/hero-level-up-notice");
    }

    heroAvatarCreditContext() {
        return this.request<HeroAvatarCreditContext>("/users/me/hero-avatar-credit-context");
    }

    heroIdentityHistory() {
        return this.request<HeroIdentityHistoryEntry[]>("/users/me/hero-identity-history");
    }

    dismissPasswordTip() {
        return this.request<GenericMessage>("/users/password-tip/dismiss", { method: "POST" });
    }

    sendEmail(input: SendEmailInput) {
        return this.request<GenericMessage>("/users/send-email", {
            method: "POST",
            body: JSON.stringify(input),
        });
    }
}
