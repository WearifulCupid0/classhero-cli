import * as clack from "@clack/prompts";
import type { AuthResponse, ClassHero } from "@classhero-cli/api-wrapper";
import type { PluginRuntime, PromptRenderResult } from "@classhero-cli/plugin-api";
import { AppContext } from "../runtime/AppContext.js";
import { SessionStore } from "../storage/SessionStore.js";

/** Login/logout and persisted-session workflow. */
export class AuthFlow {
    constructor(
        private readonly api: ClassHero,
        private readonly runtime: PluginRuntime,
        private readonly context: AppContext,
        private readonly sessions: SessionStore,
    ) {}

    async restore(): Promise<void> {
        const saved = await this.sessions.load();
        if (!saved) {
            clack.note("Você não está logado.");
            return;
        }

        this.applyTokens(saved);

        try {
            const session = await this.api.auth.session();
            if (session.ok && session.response.authenticated) {
                await this.acceptAuthentication(saved);
                clack.note(`Informações de login carregadas!\nOlá ${saved.user.name}`);
                return;
            }

            const refreshed = await this.api.auth.refreshToken(saved.refresh_token, saved.refresh_token_vm);
            if (refreshed.ok) {
                await this.sessions.save(refreshed.response);
                await this.acceptAuthentication(refreshed.response);
                clack.note(`Sessão renovada!\nOlá ${refreshed.response.user.name}`);
                return;
            }
        } catch {
            // The cleanup path below handles invalid/corrupted saved sessions.
        }

        await this.clearLocalSession();
        clack.note("Sessão salva inválida. Faça login novamente.");
    }

    async login(): Promise<void> {
        const method = await this.runtime.prompts.run<"code" | "password" | "back">({
            id: "auth.method",
            kind: "select",
            message: "Como você quer entrar?",
            options: [
                { id: "auth.method.code", value: "code", label: "Código por e-mail" },
                { id: "auth.method.password", value: "password", label: "Senha" },
                { id: "auth.method.back", value: "back", label: "Voltar" },
            ],
        });

        if (!submittedValue(method) || method.value === "back") {
            return;
        }

        if (method.value === "password") {
            await this.loginWithPassword();
        } else {
            await this.loginWithCode();
        }
    }

    async logout(): Promise<void> {
        try {
            await this.api.auth.logout();
        } catch {
            this.api.clearTokens();
        }

        await this.sessions.clear();
        this.context.clearAuthentication();
        await this.runtime.hooks.run("session:cleared", undefined, async () => undefined);
        clack.note("Sessão encerrada.");
    }

    private async loginWithCode(): Promise<void> {
        const email = await this.askEmail();
        if (!email) {
            return;
        }

        const sent = await this.api.auth.sendCode(email);
        if (!sent.ok) {
            clack.note(sent.response?.message ?? "Falha ao enviar o código. Tente novamente.");
            return;
        }

        const code = await this.runtime.prompts.run({
            id: "auth.login.code",
            kind: "text",
            message: `Informe o código enviado para ${email}`,
            validate(value) {
                return /^\d{6}$/.test(value.trim()) ? undefined : "Código inválido";
            },
        });

        if (!submittedValue(code)) {
            return;
        }

        const verified = await this.api.auth.verifyCode(email, code.value.trim());
        if (!verified.ok) {
            clack.note("Falha ao autenticar. Tente novamente.");
            return;
        }

        await this.finishLogin(verified.response);
    }

    private async loginWithPassword(): Promise<void> {
        const email = await this.askEmail();
        if (!email) {
            return;
        }

        const password = await this.runtime.prompts.run({
            id: "auth.login.password",
            kind: "text",
            secret: true,
            message: "Senha",
            validate(value) {
                return value.length > 0 ? undefined : "Senha inválida";
            },
        });

        if (!submittedValue(password)) {
            return;
        }

        const result = await this.api.auth.loginWithPassword(email, password.value);
        if (!result.ok) {
            clack.note("Falha ao autenticar. Verifique suas credenciais.");
            return;
        }

        await this.finishLogin(result.response);
    }

    private async askEmail(): Promise<string | undefined> {
        const result = await this.runtime.prompts.run({
            id: "auth.login.email",
            kind: "text",
            message: "Entre um endereço de e-mail",
            validate(value) {
                return value.includes("@") ? undefined : "Endereço de e-mail inválido";
            },
        });

        return submittedValue(result) ? result.value.trim() : undefined;
    }

    private async finishLogin(response: AuthResponse): Promise<void> {
        await this.sessions.save(response);
        await this.acceptAuthentication(response);
        clack.note(`Login realizado!\nOlá ${response.user.name}`);
    }

    private async acceptAuthentication(response: AuthResponse): Promise<void> {
        this.applyTokens(response);
        this.context.setAuthenticated(response.user);
        await this.runtime.hooks.run(
            "session:authenticated",
            { user: response.user },
            async () => undefined,
        );
    }

    private applyTokens(auth: AuthResponse): void {
        this.api.setTokens({
            accessToken: auth.access_token,
            refreshToken: auth.refresh_token,
            accessTokenVm: auth.access_token_vm,
            refreshTokenVm: auth.refresh_token_vm,
        });
    }

    private async clearLocalSession(): Promise<void> {
        this.api.clearTokens();
        this.context.clearAuthentication();
        await this.sessions.clear();
    }
}

function submittedValue<T>(result: PromptRenderResult<T>): result is Extract<PromptRenderResult<T>, { status: "submitted" }> {
    return result.status === "submitted";
}
