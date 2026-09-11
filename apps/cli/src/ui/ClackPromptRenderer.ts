import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as clack from "@clack/prompts";
import type {
    AnyPromptDefinition,
    MenuOption,
    PromptRenderResult,
    PromptRenderer,
} from "@classhero-cli/plugin-api";
import { cancelled, submitted } from "@classhero-cli/plugin-api";

interface TextEditorPayload {
    readonly initialValue?: string;
    readonly filename?: string;
}

/** Bridges renderer-neutral plugin API prompts to `@clack/prompts`. */
export class ClackPromptRenderer implements PromptRenderer {
    async render(definition: AnyPromptDefinition): Promise<PromptRenderResult<unknown>> {
        switch (definition.kind) {
            case "text": {
                const result = definition.secret
                    ? await clack.password({
                        message: definition.message,
                        ...(definition.validate === undefined ? {} : {
                            validate: (value: string | undefined) => definition.validate?.(value ?? ""),
                        }),
                    })
                    : await clack.text({
                        message: definition.message,
                        ...(definition.placeholder === undefined ? {} : { placeholder: definition.placeholder }),
                        ...(definition.initialValue === undefined ? {} : { initialValue: definition.initialValue }),
                        ...(definition.validate === undefined ? {} : {
                            validate: (value: string | undefined) => definition.validate?.(value ?? ""),
                        }),
                    });

                return toRenderResult(result);
            }

            case "confirm": {
                const result = await clack.confirm({
                    message: definition.message,
                    ...(definition.initialValue === undefined ? {} : { initialValue: definition.initialValue }),
                    ...(definition.activeLabel === undefined ? {} : { active: definition.activeLabel }),
                    ...(definition.inactiveLabel === undefined ? {} : { inactive: definition.inactiveLabel }),
                });
                return toRenderResult(result);
            }

            case "select": {
                if (definition.options.length === 0) {
                    clack.cancel("Nenhuma opção disponível.");
                    return cancelled("empty-options");
                }

                const options = definition.options.map(toClackOption);
                const result = definition.searchable
                    ? await clack.autocomplete({
                        message: definition.message,
                        options,
                        ...(definition.initialValue === undefined ? {} : { initialValue: definition.initialValue }),
                    })
                    : await clack.select({
                        message: definition.message,
                        options,
                        ...(definition.initialValue === undefined ? {} : { initialValue: definition.initialValue }),
                    });

                return toRenderResult(result);
            }

            case "multiselect": {
                if (definition.options.length === 0) {
                    clack.cancel("Nenhuma opção disponível.");
                    return cancelled("empty-options");
                }

                const result = await clack.multiselect({
                    message: definition.message,
                    options: definition.options.map(toClackOption),
                    ...(definition.initialValues === undefined ? {} : { initialValues: [...definition.initialValues] }),
                    ...(definition.required === undefined ? {} : { required: definition.required }),
                });
                return toRenderResult(result);
            }

            case "custom": {
                if (definition.renderer !== "text-editor") {
                    throw new Error(`Renderer customizado não suportado pelo host: ${definition.renderer}`);
                }

                const payload = parseTextEditorPayload(definition.payload);
                return openTextEditor(
                    payload.initialValue ?? "",
                    payload.filename ?? "classhero-response.md",
                );
            }
        }
    }
}

function toClackOption(option: MenuOption<unknown>) {
    const disabledReason = typeof option.disabled === "string" ? option.disabled : undefined;
    const hint = [option.hint, disabledReason].filter((value): value is string => Boolean(value)).join(" · ");

    return {
        label: option.label,
        value: option.value,
        ...(hint.length === 0 ? {} : { hint }),
        ...(option.disabled === undefined ? {} : { disabled: Boolean(option.disabled) }),
    };
}

function toRenderResult(value: unknown): PromptRenderResult<unknown> {
    if (clack.isCancel(value)) {
        return cancelled("user-cancelled");
    }

    return submitted(value);
}

function parseTextEditorPayload(value: unknown): TextEditorPayload {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return {};
    }

    const record = value as Record<string, unknown>;

    return {
        ...(typeof record.initialValue === "string"
            ? { initialValue: record.initialValue }
            : {}),
        ...(typeof record.filename === "string" && record.filename.trim().length > 0
            ? { filename: sanitizeFilename(record.filename) }
            : {}),
    };
}

async function openTextEditor(
    initialValue: string,
    filename: string,
): Promise<PromptRenderResult<string>> {
    const directory = await mkdtemp(
        join(tmpdir(), "classhero-cli-editor-"),
    );
    const filepath = join(directory, sanitizeFilename(filename));

    try {
        await writeFile(filepath, initialValue, "utf8");

        const exitCode = await launchEditor(filepath);
        if (exitCode !== 0) {
            return cancelled(`editor-exit-${exitCode}`);
        }

        return submitted(
            await readFile(filepath, "utf8"),
        );
    } finally {
        await rm(directory, {
            recursive: true,
            force: true,
        }).catch(() => undefined);
    }
}

async function launchEditor(filepath: string): Promise<number> {
    const configuredEditor = process.env.VISUAL?.trim() || process.env.EDITOR?.trim();

    if (configuredEditor) {
        return spawnAndWait(
            `${configuredEditor} ${shellQuote(filepath)}`,
            [],
            true,
        );
    }

    if (process.platform === "win32") {
        return spawnAndWait("notepad.exe", [filepath], false);
    }

    if (process.platform === "darwin") {
        return spawnAndWait("open", ["-W", "-a", "TextEdit", filepath], false);
    }

    return spawnAndWait("vi", [filepath], false);
}

function spawnAndWait(
    command: string,
    args: readonly string[],
    shell: boolean,
): Promise<number> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, [...args], {
            shell,
            stdio: "inherit",
        });

        child.once("error", reject);
        child.once("exit", (code) => resolve(code ?? 1));
    });
}

function shellQuote(value: string): string {
    if (process.platform === "win32") {
        return `"${value.replaceAll('"', '\\"')}"`;
    }

    return `'${value.replaceAll("'", "'\\''")}'`;
}

function sanitizeFilename(value: string): string {
    const normalized = value
        .trim()
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-");

    return normalized.length > 0
        ? normalized
        : "classhero-response.md";
}
