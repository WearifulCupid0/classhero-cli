import * as clack from "@clack/prompts";
import type { PluginRuntime } from "@classhero-cli/plugin-api";
import { PluginLoader } from "../runtime/PluginLoader.js";

/** Interactive plugin installation/configuration lifecycle menu. */
export class PluginManagementFlow {
    constructor(
        private readonly runtime: PluginRuntime,
        private readonly loader: PluginLoader,
    ) {}

    async run(): Promise<void> {
        while (true) {
            const configured = await this.loader.list();
            const selection = await this.runtime.prompts.run<"toggle" | "add" | "remove" | "back">({
                id: "plugins.manage",
                kind: "select",
                message: "Plugins",
                options: [
                    {
                        id: "plugins.manage.toggle",
                        value: "toggle",
                        label: "Ativar/desativar plugin",
                        disabled: configured.length === 0 ? "Nenhum plugin configurado" : false,
                    },
                    { id: "plugins.manage.add", value: "add", label: "Adicionar plugin" },
                    {
                        id: "plugins.manage.remove",
                        value: "remove",
                        label: "Remover plugin",
                        disabled: configured.length === 0 ? "Nenhum plugin configurado" : false,
                    },
                    { id: "plugins.manage.back", value: "back", label: "Voltar" },
                ],
            });

            if (selection.status !== "submitted" || selection.value === "back") {
                return;
            }

            if (selection.value === "add") {
                await this.add();
            } else if (selection.value === "toggle") {
                await this.toggle();
            } else {
                await this.remove();
            }
        }
    }

    private async add(): Promise<void> {
        const specifier = await this.runtime.prompts.run({
            id: "plugins.add.specifier",
            kind: "text",
            message: "Pacote ou caminho do plugin",
            placeholder: "@vendor/plugin ou ./plugins/plugin.js",
            validate(value) {
                return value.trim().length > 0 ? undefined : "Informe um módulo de plugin";
            },
        });

        if (specifier.status !== "submitted") {
            return;
        }

        const enable = await this.runtime.prompts.run({
            id: "plugins.add.enable",
            kind: "confirm",
            message: "Ativar o plugin agora?",
            initialValue: true,
        });

        if (enable.status !== "submitted") {
            return;
        }

        try {
            const loaded = await this.loader.add(specifier.value.trim(), enable.value);
            clack.note(`Plugin registrado: ${loaded.pluginId}`);
        } catch (error) {
            clack.note(formatError(error), "Falha ao carregar plugin");
        }
    }

    private async toggle(): Promise<void> {
        const plugins = await this.loader.list();
        if (plugins.length === 0) {
            return;
        }

        const selection = await this.runtime.prompts.run({
            id: "plugins.toggle.select",
            kind: "select",
            searchable: true,
            message: "Selecione um plugin",
            options: plugins.map((plugin) => ({
                id: `plugins.toggle.${plugin.specifier}`,
                value: plugin.specifier,
                label: plugin.runtime?.name ?? plugin.pluginId ?? plugin.specifier,
                hint: plugin.enabled ? "ativado" : "desativado",
            })),
        });

        if (selection.status !== "submitted") {
            return;
        }

        const current = plugins.find((plugin) => plugin.specifier === selection.value);
        if (!current) {
            return;
        }

        try {
            await this.loader.setEnabled(current.specifier, !current.enabled);
            clack.note(`${current.enabled ? "Desativado" : "Ativado"}: ${current.runtime?.name ?? current.specifier}`);
        } catch (error) {
            clack.note(formatError(error), "Falha ao alterar plugin");
        }
    }

    private async remove(): Promise<void> {
        const plugins = await this.loader.list();
        if (plugins.length === 0) {
            return;
        }

        const selection = await this.runtime.prompts.run({
            id: "plugins.remove.select",
            kind: "select",
            searchable: true,
            message: "Selecione um plugin para remover",
            options: plugins.map((plugin) => ({
                id: `plugins.remove.${plugin.specifier}`,
                value: plugin.specifier,
                label: plugin.runtime?.name ?? plugin.pluginId ?? plugin.specifier,
            })),
        });

        if (selection.status !== "submitted") {
            return;
        }

        const confirm = await this.runtime.prompts.run({
            id: "plugins.remove.confirm",
            kind: "confirm",
            message: `Remover ${selection.value} da configuração?`,
            initialValue: false,
        });

        if (confirm.status !== "submitted" || !confirm.value) {
            return;
        }

        try {
            await this.loader.remove(selection.value);
            clack.note(`Plugin removido: ${selection.value}`);
        } catch (error) {
            clack.note(formatError(error), "Falha ao remover plugin");
        }
    }
}

function formatError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
