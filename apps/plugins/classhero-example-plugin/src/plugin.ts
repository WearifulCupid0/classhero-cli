import {
    CLI_CONTEXT,
    PLUGIN_API_VERSION,
    type ClassHeroPlugin,
    type CliContextSnapshot,
    type PluginContext,
} from "@classhero-cli/plugin-api";
import {
    EXAMPLE_PLUGIN_SERVICE,
    type ExamplePluginService,
} from "./service.js";

const EXECUTION_COUNT_KEY = "executionCount";
const INSTALLED_AT_KEY = "installedAt";
const LAST_ACTIVITY_KEY = "lastActivity";

/** Actions exposed by the example plugin's own prompt flow. */
type DiagnosticAction =
    | "context"
    | "storage"
    | "service"
    | "api-session"
    | "back";

/**
 * Diagnostic plugin used to validate the complete ClassHero CLI plugin
 * lifecycle and extension surface.
 */
export const plugin: ClassHeroPlugin = {
    manifest: {
        id: "classhero-example-plugin",
        name: "ClassHero Example Plugin",
        version: "1.0.0",
        apiVersion: PLUGIN_API_VERSION,
        description: "Plugin de diagnóstico para testar menus, hooks, prompts, storage, services e acesso à API.",
    },

    /**
     * Performs one-time initialization.
     *
     * The installation timestamp remains available while the plugin exists,
     * even if it is disabled and enabled again.
     */
    async register(context) {
        const installedAt = await context.storage.get<string>(INSTALLED_AT_KEY);
        if (!installedAt) {
            await context.storage.set(INSTALLED_AT_KEY, new Date().toISOString());
        }

        context.logger.info("Plugin registrado.");
    },

    /**
     * Registers every behavior that should exist only while the plugin is
     * enabled. The runtime removes these resources automatically on disable.
     */
    enable(context) {
        const diagnosticsService: ExamplePluginService = {
            getExecutionCount: async () =>
                (await context.storage.get<number>(EXECUTION_COUNT_KEY)) ?? 0,
        };

        context.services.provide(
            EXAMPLE_PLUGIN_SERVICE,
            diagnosticsService,
            { priority: 10 },
        );

        context.menus.contribute<string>(
            "main",
            (menu) => {
                const option = {
                    id: "example-plugin.open",
                    value: "example-plugin.open",
                    label: "Plugin de teste",
                    hint: "diagnóstico da plugin-api",
                    onSelect: async () => runDiagnostics(context),
                };

                if (menu.has("main.plugins")) {
                    menu.addBefore("main.plugins", option);
                } else {
                    menu.add(option);
                }
            },
            { priority: 10 },
        );

        context.hooks.use(
            "cli:ready",
            async ({ next }) => {
                context.logger.info("Plugin habilitado e CLI pronta.");
                return next();
            },
        );

        context.hooks.use(
            "activity:selected",
            async ({ payload, next }) => {
                await context.storage.set(LAST_ACTIVITY_KEY, {
                    id: payload.id,
                    ...(payload.name === undefined ? {} : { name: payload.name }),
                    selectedAt: new Date().toISOString(),
                });

                context.logger.debug("Atividade observada pelo hook.", {
                    activityId: payload.id,
                    ...(payload.name === undefined ? {} : { activityName: payload.name }),
                });

                return next();
            },
        );

        context.logger.info("Plugin habilitado.");
    },

    /** Logs the transition before enable-scoped resources are released. */
    disable(context) {
        context.logger.info("Plugin desabilitado.");
    },

    /** Logs final unload of the plugin. */
    dispose(context) {
        context.logger.info("Plugin descartado.");
    },
};

/** Default export recognized directly by the CLI PluginLoader. */
export default plugin;

async function runDiagnostics(context: PluginContext): Promise<void> {
    await incrementExecutionCount(context);

    while (true) {
        const result = await context.prompts.run<DiagnosticAction>({
            id: "example-plugin.menu",
            kind: "select",
            message: "O que deseja testar?",
            options: [
                {
                    id: "example-plugin.context",
                    value: "context",
                    label: "Ler contexto atual do CLI",
                },
                {
                    id: "example-plugin.storage",
                    value: "storage",
                    label: "Testar storage persistente",
                },
                {
                    id: "example-plugin.service",
                    value: "service",
                    label: "Testar ServiceRegistry",
                },
                {
                    id: "example-plugin.api-session",
                    value: "api-session",
                    label: "Testar acesso ao api-wrapper",
                },
                {
                    id: "example-plugin.back",
                    value: "back",
                    label: "Voltar",
                },
            ],
        });

        if (result.status !== "submitted" || result.value === "back") {
            return;
        }

        switch (result.value) {
            case "context":
                logCliContext(context);
                break;

            case "storage":
                await testStorage(context);
                break;

            case "service":
                await testServiceRegistry(context);
                break;

            case "api-session":
                await testApiSession(context);
                break;
        }
    }
}

async function incrementExecutionCount(context: PluginContext): Promise<number> {
    const current = (await context.storage.get<number>(EXECUTION_COUNT_KEY)) ?? 0;
    const next = current + 1;

    await context.storage.set(EXECUTION_COUNT_KEY, next);
    return next;
}

function logCliContext(context: PluginContext): void {
    const provider = context.services.get(CLI_CONTEXT);

    if (!provider) {
        context.logger.warn("CLI_CONTEXT não está disponível.");
        return;
    }

    const snapshot = provider.getSnapshot();
    context.logger.info("Snapshot atual do CLI:", toSnapshotMetadata(snapshot));
}

async function testStorage(context: PluginContext): Promise<void> {
    const count = (await context.storage.get<number>(EXECUTION_COUNT_KEY)) ?? 0;
    const installedAt = await context.storage.get<string>(INSTALLED_AT_KEY);
    const lastActivity = await context.storage.get<unknown>(LAST_ACTIVITY_KEY);
    const keys = await context.storage.keys();

    context.logger.info("Storage do plugin funcionando.", {
        executionCount: count,
        installedAt: installedAt ?? "desconhecido",
        keys: [...keys],
        hasLastActivity: lastActivity !== undefined,
    });
}

async function testServiceRegistry(context: PluginContext): Promise<void> {
    const service = context.services.get(EXAMPLE_PLUGIN_SERVICE);

    if (!service) {
        context.logger.error("O serviço de diagnóstico não foi encontrado.");
        return;
    }

    context.logger.info("ServiceRegistry funcionando.", {
        executionCount: await service.getExecutionCount(),
    });
}

async function testApiSession(context: PluginContext): Promise<void> {
    const cliContext = context.services.get(CLI_CONTEXT)?.getSnapshot();

    if (!cliContext?.authenticated) {
        context.logger.warn("Faça login antes de testar a sessão da API.");
        return;
    }

    try {
        const response = await context.api.auth.session();

        context.logger.info("api-wrapper acessado pelo plugin.", {
            ok: response.ok,
            status: response.status,
            authenticated: response.response?.authenticated ?? false,
        });
    } catch (error) {
        context.logger.error("Falha ao consultar /auth/session.", {
            error: error instanceof Error ? error.message : String(error),
        });
    }
}

function toSnapshotMetadata(snapshot: CliContextSnapshot): Record<string, unknown> {
    return {
        authenticated: snapshot.authenticated,
        user: snapshot.user?.name ?? snapshot.user?.id ?? null,
        discipline: snapshot.discipline?.name ?? snapshot.discipline?.id ?? null,
        mission: snapshot.mission?.name ?? snapshot.mission?.id ?? null,
        activity: snapshot.activity?.name ?? snapshot.activity?.id ?? null,
    };
}
