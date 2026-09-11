import type {
    PluginContext,
} from "@classhero-cli/plugin-api";
import {
    editMissionText,
} from "./MissionEditors.js";

type PromptChoice =
    | "default"
    | "edit-default"
    | "custom"
    | "back";

/**
 * Allows prompt customization only from the explicit mission reflection and
 * synthesis flows. Provider settings remain prompt-free.
 */
export async function chooseMissionPrompt(
    context: PluginContext,
    input: {
        readonly idPrefix: string;
        readonly title: string;
        readonly defaultPrompt: string;
    },
): Promise<string | undefined> {
    const selection = await context.prompts.run<PromptChoice>({
        id: `${input.idPrefix}.prompt-mode`,
        kind: "select",
        message: `Prompt de IA — ${input.title}`,
        options: [
            {
                id: `${input.idPrefix}.prompt.default`,
                value: "default",
                label: "Usar prompt padrão",
            },
            {
                id: `${input.idPrefix}.prompt.edit-default`,
                value: "edit-default",
                label: "Editar prompt padrão",
                hint: "abre no editor antes da geração",
            },
            {
                id: `${input.idPrefix}.prompt.custom`,
                value: "custom",
                label: "Criar meu próprio prompt",
            },
            {
                id: `${input.idPrefix}.prompt.back`,
                value: "back",
                label: "Voltar",
            },
        ],
        initialValue: "default",
    });

    if (
        selection.status !== "submitted" ||
        selection.value === "back"
    ) {
        return undefined;
    }

    if (selection.value === "default") {
        return input.defaultPrompt;
    }

    const edited = await editMissionText(
        context,
        {
            id: `${input.idPrefix}.prompt-editor`,
            message:
                selection.value === "custom"
                    ? `Escreva o prompt personalizado para ${input.title}.`
                    : `Revise o prompt padrão para ${input.title}.`,
            filename: `${input.idPrefix}-prompt.txt`,
            initialValue:
                selection.value === "custom"
                    ? ""
                    : input.defaultPrompt,
        },
    );

    const normalized = edited?.trim();

    if (!normalized) {
        context.logger.warn(
            "O prompt ficou vazio; a geração por IA foi cancelada.",
        );
        return undefined;
    }

    return normalized;
}
