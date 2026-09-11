import type {
    KnowledgeMapNode,
} from "@classhero-cli/api-wrapper";
import type {
    KnowledgeMapActivityContribution,
    KnowledgeMapActivityDraft,
} from "../prompts/KnowledgeMapActivityPrompt.js";

/** Renders one editable idea/doubt block per teacher/reference node. */
export function renderKnowledgeMapTemplate(
    title: string,
    referenceNodes: readonly KnowledgeMapNode[],
    draft: KnowledgeMapActivityDraft,
    strictFinal: boolean,
): string {
    const byKey = new Map(
        draft.contributions.map(
            (item) => [
                `${item.referenceNodeId}:${item.kind}`,
                item.text,
            ],
        ),
    );

    const parts: string[] = [
        `# ${title}`,
        strictFinal
            ? "# Preencha/revise um APRENDIZADO e uma DUVIDA para cada tema."
            : "# Preencha somente as contribuições que fizerem sentido nesta etapa; pelo menos uma é necessária.",
        "# Não altere as linhas <<<TEMA:id>>> / <<<FIM_TEMA>>>.",
        "# Campos vazios são ignorados em mapas não finais.",
        "",
    ];

    for (
        const node of
            referenceNodes
    ) {
        parts.push(
            `<<<TEMA:${node.id}>>>`,
            `# ${node.label}`,
            "<<<APRENDIZADO>>>",
            byKey.get(
                `${node.id}:idea`,
            ) ?? "",
            "<<<FIM_APRENDIZADO>>>",
            "<<<DUVIDA>>>",
            byKey.get(
                `${node.id}:doubt`,
            ) ?? "",
            "<<<FIM_DUVIDA>>>",
            "<<<FIM_TEMA>>>",
            "",
        );
    }

    return parts.join("\n");
}

/**
 * Parses the editor document.
 *
 * Final synthesis is strict: every reference node needs one idea and one
 * doubt. Initial/intermediate checks allow a sparse map but require at least
 * one contribution overall.
 */
export function parseKnowledgeMapTemplate(
    text: string,
    referenceNodes: readonly KnowledgeMapNode[],
    strictFinal: boolean,
): KnowledgeMapActivityDraft | undefined {
    const contributions:
        KnowledgeMapActivityContribution[] = [];

    for (
        const node of
            referenceNodes
    ) {
        const escaped =
            escapeRegExp(
                node.id,
            );
        const match =
            new RegExp(
                `<<<TEMA:${escaped}>>>([\\s\\S]*?)<<<FIM_TEMA>>>`,
            ).exec(text);

        if (!match?.[1]) {
            return undefined;
        }

        const idea =
            optionalSection(
                match[1],
                "APRENDIZADO",
            );
        const doubt =
            optionalSection(
                match[1],
                "DUVIDA",
            );

        if (
            strictFinal &&
            (!idea || !doubt)
        ) {
            return undefined;
        }

        if (idea) {
            contributions.push({
                referenceNodeId:
                    node.id,
                kind:
                    "idea",
                text:
                    idea,
            });
        }

        if (doubt) {
            contributions.push({
                referenceNodeId:
                    node.id,
                kind:
                    "doubt",
                text:
                    doubt,
            });
        }
    }

    return contributions.length > 0
        ? {
            contributions,
        }
        : undefined;
}

/** Converts currently saved student nodes into the generic editor draft. */
export function existingKnowledgeMapDraft(
    referenceNodes: readonly KnowledgeMapNode[],
    currentNodes: readonly KnowledgeMapNode[],
): KnowledgeMapActivityDraft {
    const referenceIds = new Set(
        referenceNodes.map(
            (node) => node.id,
        ),
    );

    const contributions:
        KnowledgeMapActivityContribution[] = [];

    for (const node of currentNodes) {
        const kind =
            node.kind === "idea"
                ? "idea" as const
                : node.kind === "doubt"
                    ? "doubt" as const
                    : undefined;

        if (
            node.student_added !==
                true ||
            !node.parent_id ||
            !referenceIds.has(
                node.parent_id,
            ) ||
            !kind ||
            !node.label.trim()
        ) {
            continue;
        }

        const key =
            `${node.parent_id}:${kind}`;

        /* Preserve the first saved node for each semantic slot. */
        if (
            contributions.some(
                (item) =>
                    `${item.referenceNodeId}:${item.kind}` ===
                    key,
            )
        ) {
            continue;
        }

        contributions.push({
            referenceNodeId:
                node.parent_id,
            kind,
            text:
                node.label,
        });
    }

    return {
        contributions,
    };
}

function optionalSection(
    text: string,
    name: string,
): string | undefined {
    const match =
        new RegExp(
            `<<<${name}>>>\\s*([\\s\\S]*?)\\s*<<<FIM_${name}>>>`,
        ).exec(text);

    if (!match) {
        return undefined;
    }

    const value =
        match[1]?.trim() ??
        "";

    return value.length > 0
        ? value
        : undefined;
}

function escapeRegExp(
    value: string,
): string {
    return value.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
    );
}
