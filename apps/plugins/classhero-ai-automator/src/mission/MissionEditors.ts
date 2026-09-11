import type {
    KnowledgeMapNode,
} from "@classhero-cli/api-wrapper";
import type {
    PluginContext,
} from "@classhero-cli/plugin-api";
import type {
    MissionReflectionDraft,
} from "../prompts/MissionReflectionPrompt.js";
import type {
    MissionSynthesisContribution,
    MissionSynthesisDraft,
} from "../prompts/MissionSynthesisPrompt.js";

/** Opens the host's external text editor and returns its final UTF-8 contents. */
export async function editMissionText(
    context: PluginContext,
    input: {
        readonly id: string;
        readonly message: string;
        readonly filename: string;
        readonly initialValue: string;
    },
): Promise<string | undefined> {
    context.logger.info(
        `${input.message} O editor de texto configurado no sistema será aberto.`,
    );

    const result = await context.prompts.run<string>({
        id: input.id,
        kind: "custom",
        message: input.message,
        renderer: "text-editor",
        payload: {
            filename: input.filename,
            initialValue: input.initialValue,
        },
    });

    return result.status === "submitted"
        ? result.value
        : undefined;
}

/** Creates the four-field reflection editor document. */
export function renderReflectionTemplate(
    draft?: Partial<MissionReflectionDraft>,
): string {
    return [
        "# Reflexão final da missão",
        "# Edite somente o conteúdo entre os marcadores. Estas linhas iniciadas por # são ignoradas.",
        "",
        "<<<ENTENDIMENTO>>>",
        draft?.understoodText ?? "",
        "<<<FIM_ENTENDIMENTO>>>",
        "",
        "<<<DUVIDAS>>>",
        draft?.doubtsText ?? "",
        "<<<FIM_DUVIDAS>>>",
        "",
        "<<<APLICACAO>>>",
        draft?.applicationText ?? "",
        "<<<FIM_APLICACAO>>>",
        "",
        "<<<PERGUNTA>>>",
        draft?.questionText ?? "",
        "<<<FIM_PERGUNTA>>>",
        "",
    ].join("\n");
}

/** Parses and validates the reflection editor document. */
export function parseReflectionTemplate(
    text: string,
): MissionReflectionDraft | undefined {
    const understoodText = section(text, "ENTENDIMENTO");
    const doubtsText = section(text, "DUVIDAS");
    const applicationText = section(text, "APLICACAO");
    const questionText = section(text, "PERGUNTA");

    if (!understoodText || !doubtsText || !applicationText || !questionText) {
        return undefined;
    }

    return {
        understoodText,
        doubtsText,
        applicationText,
        questionText,
    };
}

/** Renders one editable idea+doubt block per professor reference node. */
export function renderSynthesisTemplate(
    referenceNodes: readonly KnowledgeMapNode[],
    draft?: MissionSynthesisDraft,
): string {
    const existing = new Map(
        draft?.contributions.map((item) => [item.referenceNodeId, item]) ?? [],
    );

    const parts: string[] = [
        "# Síntese conceitual da missão",
        "# Para cada tema, revise/preencha um aprendizado e uma dúvida final.",
        "# Não altere as linhas <<<TEMA:id>>> / <<<FIM_TEMA>>>.",
        "",
    ];

    for (const node of referenceNodes) {
        const contribution = existing.get(node.id);

        parts.push(
            `<<<TEMA:${node.id}>>>`,
            `# ${node.label}`,
            "<<<APRENDIZADO>>>",
            contribution?.idea ?? "",
            "<<<FIM_APRENDIZADO>>>",
            "<<<DUVIDA>>>",
            contribution?.doubt ?? "",
            "<<<FIM_DUVIDA>>>",
            "<<<FIM_TEMA>>>",
            "",
        );
    }

    return parts.join("\n");
}

/** Parses the synthesis document and requires one idea+doubt for every theme. */
export function parseSynthesisTemplate(
    text: string,
    referenceNodes: readonly KnowledgeMapNode[],
): MissionSynthesisDraft | undefined {
    const contributions: MissionSynthesisContribution[] = [];

    for (const node of referenceNodes) {
        const escaped = escapeRegExp(node.id);
        const blockMatch = new RegExp(
            `<<<TEMA:${escaped}>>>([\\s\\S]*?)<<<FIM_TEMA>>>`,
        ).exec(text);

        if (!blockMatch?.[1]) {
            return undefined;
        }

        const idea = section(blockMatch[1], "APRENDIZADO");
        const doubt = section(blockMatch[1], "DUVIDA");

        if (!idea || !doubt) {
            return undefined;
        }

        contributions.push({
            referenceNodeId: node.id,
            idea,
            doubt,
        });
    }

    return { contributions };
}

/** Reads current student-added idea/doubt nodes into the editor draft shape. */
export function existingSynthesisDraft(
    referenceNodes: readonly KnowledgeMapNode[],
    studentNodes: readonly KnowledgeMapNode[],
): MissionSynthesisDraft {
    const contributions = referenceNodes.map((reference) => {
        const children = studentNodes.filter(
            (node) =>
                node.student_added === true &&
                String(node.parent_id ?? "") === reference.id,
        );

        return {
            referenceNodeId: reference.id,
            idea: children.find((node) => node.kind === "idea")?.label ?? "",
            doubt: children.find((node) => node.kind === "doubt")?.label ?? "",
        };
    });

    return { contributions };
}

function section(
    text: string,
    name: string,
): string | undefined {
    const match = new RegExp(
        `<<<${name}>>>\\s*([\\s\\S]*?)\\s*<<<FIM_${name}>>>`,
    ).exec(text);

    const value = match?.[1]?.trim();
    return value ? value : undefined;
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
