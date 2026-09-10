import * as clack from "@clack/prompts";
import { ClassHero } from "@classhero-cli/api-wrapper";
import {
    CLI_CONTEXT,
    createPluginRuntime,
    type Disposable,
    type MenuOption,
    type PluginRuntime,
} from "@classhero-cli/plugin-api";
import { BANNER, CLI_ENABLE_EVAL_ENV } from "./constants.js";
import { ActivityFlow } from "./flows/ActivityFlow.js";
import { AuthFlow } from "./flows/AuthFlow.js";
import { DisciplineFlow } from "./flows/DisciplineFlow.js";
import { EvalFlow } from "./flows/EvalFlow.js";
import { MissionFlow } from "./flows/MissionFlow.js";
import { PluginManagementFlow } from "./flows/PluginManagementFlow.js";
import { AppContext } from "./runtime/AppContext.js";
import { PluginConfigStore } from "./runtime/PluginConfigStore.js";
import { PluginLoader } from "./runtime/PluginLoader.js";
import { resolveCliPaths } from "./runtime/paths.js";
import { createFilePluginStorageFactory } from "./storage/FilePluginStorage.js";
import { SessionStore } from "./storage/SessionStore.js";
import { ClackPromptRenderer } from "./ui/ClackPromptRenderer.js";

/** Main interactive ClassHero CLI application. */
export class CLI {
    readonly classhero: ClassHero;
    readonly runtime: PluginRuntime;
    readonly context: AppContext;

    private readonly authFlow: AuthFlow;
    private readonly disciplineFlow: DisciplineFlow;
    private readonly missionFlow: MissionFlow;
    private readonly activityFlow: ActivityFlow;
    private readonly pluginFlow: PluginManagementFlow;
    private readonly evalFlow: EvalFlow;
    private readonly pluginLoader: PluginLoader;
    private readonly hostContextRegistration: Disposable;
    private stopping = false;

    constructor() {
        const paths = resolveCliPaths();

        this.classhero = new ClassHero();
        this.context = new AppContext();
        this.runtime = createPluginRuntime({
            api: this.classhero,
            renderer: new ClackPromptRenderer(),
            storageFactory: createFilePluginStorageFactory(paths.pluginStorage),
        });

        this.hostContextRegistration = this.runtime.services.provide(
            CLI_CONTEXT,
            this.context,
            { owner: "host:cli" },
        );

        const sessions = new SessionStore(paths.session, paths.legacyLogin);
        const pluginConfig = new PluginConfigStore(paths.pluginConfig);
        this.pluginLoader = new PluginLoader(this.runtime.plugins, pluginConfig);

        this.authFlow = new AuthFlow(this.classhero, this.runtime, this.context, sessions);
        this.disciplineFlow = new DisciplineFlow(this.classhero, this.runtime, this.context);
        this.missionFlow = new MissionFlow(this.classhero, this.runtime, this.context);
        this.activityFlow = new ActivityFlow(this.classhero, this.runtime, this.context);
        this.pluginFlow = new PluginManagementFlow(this.runtime, this.pluginLoader);
        this.evalFlow = new EvalFlow(this.runtime);
    }

    async start(): Promise<void> {
        clack.intro(BANNER);

        try {
            await this.loadPlugins();

            await this.runtime.hooks.run(
                "cli:starting",
                { timestamp: new Date() },
                async () => undefined,
            );

            await this.authFlow.restore();

            await this.runtime.hooks.run(
                "cli:ready",
                { timestamp: new Date() },
                async () => undefined,
            );

            await this.mainLoop();
        } finally {
            await this.shutdown();
        }
    }

    private async mainLoop(): Promise<void> {
        while (!this.stopping) {
            this.renderContext();

            const result = await this.runtime.prompts.run<string>({
                id: "main",
                kind: "select",
                message: "O que você quer fazer?",
                options: this.mainOptions(),
            });

            if (result.status === "cancelled") {
                this.stopping = true;
            }
        }
    }

    private mainOptions(): readonly MenuOption<string>[] {
        const options: MenuOption<string>[] = [];

        if (!this.context.authenticated) {
            options.push({
                id: "main.login",
                value: "login",
                label: "Login",
                onSelect: async () => this.authFlow.login(),
            });
        } else {
            options.push({
                id: "main.disciplines",
                value: "disciplines",
                label: "Selecionar disciplina",
                onSelect: async () => this.disciplineFlow.run(),
            });

            if (this.context.discipline) {
                options.push({
                    id: "main.missions",
                    value: "missions",
                    label: "Selecionar missão",
                    onSelect: async () => this.missionFlow.run(),
                });
            }

            if (this.context.mission) {
                options.push({
                    id: "main.activities",
                    value: "activities",
                    label: "Carregar atividades",
                    onSelect: async () => this.activityFlow.run(),
                });
            }

            options.push({
                id: "main.logout",
                value: "logout",
                label: "Logout",
                onSelect: async () => this.authFlow.logout(),
            });
        }

        options.push({
            id: "main.plugins",
            value: "plugins",
            label: "Plugins",
            onSelect: async () => this.pluginFlow.run(),
        });

        if (process.env[CLI_ENABLE_EVAL_ENV] === "1") {
            options.push({
                id: "main.eval",
                value: "eval",
                label: "Eval",
                hint: "modo de desenvolvimento",
                onSelect: async () => this.evalFlow.run(),
            });
        }

        options.push({
            id: "main.exit",
            value: "exit",
            label: "Sair",
            onSelect: () => {
                this.stopping = true;
            },
        });

        return options;
    }

    private renderContext(): void {
        const labels: string[] = [];
        if (this.context.discipline) {
            labels.push(`Disciplina: ${this.context.discipline.name}`);
        }
        if (this.context.mission) {
            labels.push(`Missão: ${this.context.mission.name}`);
        }
        if (this.context.activity) {
            labels.push(`Atividade: ${this.context.activity.name}`);
        }

        if (labels.length > 0) {
            clack.note(labels.join("\n"));
        }
    }

    private async loadPlugins(): Promise<void> {
        try {
            const report = await this.pluginLoader.loadConfigured();
            for (const failure of report.failures) {
                const message = failure.error instanceof Error ? failure.error.message : String(failure.error);
                clack.note(`${failure.specifier}\n${message}`, "Plugin não carregado");
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            clack.note(message, "Falha ao ler configuração de plugins");
        }
    }

    private async shutdown(): Promise<void> {
        await this.runtime.hooks.run(
            "cli:stopping",
            { timestamp: new Date() },
            async () => undefined,
        ).catch(() => undefined);

        await this.runtime.plugins.disposeAll().catch(() => undefined);
        await Promise.resolve(this.hostContextRegistration.dispose()).catch(() => undefined);
        clack.outro("Adeus!");
    }
}
