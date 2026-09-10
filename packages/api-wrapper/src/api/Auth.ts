import { Api } from "../client/Api.js";
import type {
    AuthResponse,
    AuthSession,
    GenericMessage,
    PasswordLoginRequest,
    SendCodeRequest,
    SetPasswordRequest,
    StopImpersonateResponse,
    VerifyCodeRequest,
} from "../types/index.js";

/** Authentication endpoints observed in the ClassHero web client. */
export class Auth extends Api {
    sendCode(email: string) {
        const payload: SendCodeRequest = { email };

        return this.request<GenericMessage>("/auth/send-code", {
            method: "POST",
            body: JSON.stringify(payload),
            tryRefreshOn401: false,
        });
    }

    async verifyCode(email: string, code: string) {
        const payload: VerifyCodeRequest = { email, code };
        const result = await this.request<AuthResponse>("/auth/verify-code", {
            method: "POST",
            body: JSON.stringify(payload),
            tryRefreshOn401: false,
        });

        if (result.ok) {
            this.client.setTokensFromAuth(result.response);
        }

        return result;
    }

    setPassword(password: string, token?: string) {
        const payload: SetPasswordRequest = { password };

        return this.request<GenericMessage>("/auth/set-password", {
            method: "POST",
            body: JSON.stringify(payload),
            tryRefreshOn401: false,
        }, token);
    }

    async loginWithPassword(email: string, password: string) {
        const payload: PasswordLoginRequest = { email, password };
        const result = await this.request<AuthResponse>("/auth/login-with-password", {
            method: "POST",
            body: JSON.stringify(payload),
            tryRefreshOn401: false,
        });

        if (result.ok) {
            this.client.setTokensFromAuth(result.response);
        }

        return result;
    }

    async refreshToken(refreshToken?: string, refreshTokenVm?: string) {
        const current = this.client.getTokens();
        const regular = refreshToken ?? current.refreshToken;
        const vm = refreshTokenVm ?? current.refreshTokenVm ?? regular;
        const body: Record<string, string> = {};

        if (regular) {
            body.refresh_token = regular;
        }

        if (vm) {
            body.refresh_token_vm = vm;
        }

        const result = await this.request<AuthResponse>("/auth/refresh-token", {
            method: "POST",
            body: JSON.stringify(body),
            tryRefreshOn401: false,
        });

        if (result.ok) {
            this.client.setTokensFromAuth(result.response);
        }

        return result;
    }

    session() {
        return this.request<AuthSession>("/auth/session", {
            method: "GET",
            tryRefreshOn401: false,
        });
    }

    async logout() {
        try {
            return await this.request<GenericMessage>("/auth/logout", { method: "POST" });
        } finally {
            this.client.clearTokens();
        }
    }

    impersonate(email: string) {
        return this.request<GenericMessage>("/auth/impersonate", {
            method: "POST",
            body: JSON.stringify({ email }),
        });
    }

    stopImpersonate() {
        return this.request<StopImpersonateResponse>("/auth/stop-impersonate", {
            method: "POST",
        });
    }
}
