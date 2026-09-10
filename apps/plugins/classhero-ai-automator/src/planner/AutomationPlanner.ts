import type {
    ActivityCapability,
    ActivityContext,
    AutomationPlan,
    AutomationTarget,
    AutomationTargetId,
} from "../contracts/activity.js";

const WORD_SEARCH: AutomationTarget = {
    id: "word-search",
    label: "Caça-palavras",
    description: "Resolve a matriz em oito direções sem usar IA.",
    strategy: "native",
    executable: true,
};

const MEMORY: AutomationTarget = {
    id: "memory",
    label: "Jogo da memória",
    description: "Relaciona palavras e definições do glossário sem usar IA.",
    strategy: "native",
    executable: true,
};

const HANGMAN: AutomationTarget = {
    id: "hangman",
    label: "Forca",
    description: "Usa um AI Provider para propor hipóteses e o ClassHero como fonte de verdade.",
    strategy: "ai",
    executable: true,
};

const QUIZ: AutomationTarget = {
    id: "quiz",
    label: "Quiz",
    description: "Resolve cada pergunta com um AI Provider e valida a resposta antes de seguir.",
    strategy: "ai",
    executable: true,
};

const INTERACTIVE_PATH: AutomationTarget = {
    id: "interactive-path",
    label: "Caminho interativo",
    description: "Passos sem resposta determinística são delegados a um AI Provider.",
    strategy: "ai",
    executable: false,
};

const CODE: AutomationTarget = {
    id: "code",
    label: "Atividade de código",
    description: "Geração/interpretação de código é delegada a um AI Provider.",
    strategy: "ai",
    executable: false,
};

const DISCURSIVE: AutomationTarget = {
    id: "discursive",
    label: "Atividade discursiva",
    description: "Produção textual contextual é delegada a um AI Provider.",
    strategy: "ai",
    executable: false,
};

const TARGETS_BY_CAPABILITY: Readonly<
    Record<ActivityCapability, readonly AutomationTarget[]>
> = {
    games: [
        WORD_SEARCH,
        MEMORY,
        HANGMAN,
    ],
    quiz: [
        QUIZ,
    ],
    "interactive-path": [
        INTERACTIVE_PATH,
    ],
    code: [
        CODE,
    ],
    discursive: [
        DISCURSIVE,
    ],
};

/**
 * Capability-based planner.
 *
 * A selected ClassHero activity may expose more than one automation family,
 * such as games + quiz.
 */
export class AutomationPlanner {
    plan(context: ActivityContext): AutomationPlan {
        const targets =
            uniqueTargets(
                context.capabilities.flatMap(
                    (capability) =>
                        TARGETS_BY_CAPABILITY[
                            capability
                        ],
                ),
            );

        if (targets.length === 0) {
            return {
                context,
                targets,
                reason:
                    `O tipo de material '${context.materialType}' ainda não possui estratégia de automação conhecida.`,
            };
        }

        const recommendedTargetId =
            recommendationFor(
                context,
                targets,
            );

        return {
            context,
            targets,
            ...(recommendedTargetId === undefined
                ? {}
                : {
                    recommendedTargetId,
                }),
            reason:
                context.capabilities.length > 1
                    ? `A atividade expõe múltiplas capacidades (${context.capabilities.join(" + ")}); todos os fluxos compatíveis foram disponibilizados.`
                    : reasonFor(
                        context.capabilities[0]!,
                    ),
        };
    }
}

function uniqueTargets(
    targets: readonly AutomationTarget[],
): AutomationTarget[] {
    const byId =
        new Map<
            AutomationTargetId,
            AutomationTarget
        >();

    for (const target of targets) {
        byId.set(
            target.id,
            target,
        );
    }

    return [
        ...byId.values(),
    ];
}

function recommendationFor(
    context: ActivityContext,
    targets: readonly AutomationTarget[],
): AutomationTargetId | undefined {
    const preferred:
        Partial<
            Record<
                ActivityContext["kind"],
                AutomationTargetId
            >
        > = {
        games:
            "word-search",
        quiz:
            "quiz",
        "interactive-path":
            "interactive-path",
        code:
            "code",
        discursive:
            "discursive",
    };

    const id =
        preferred[
            context.kind
        ];

    return (
        id !== undefined &&
        targets.some(
            (target) =>
                target.id === id,
        )
    )
        ? id
        : targets[0]?.id;
}

function reasonFor(
    capability: ActivityCapability,
): string {
    switch (capability) {
        case "games":
            return "A atividade possui mini-games: caça-palavras e memória são determinísticos; forca usa IA com validação do backend.";
        case "quiz":
            return "A atividade possui quiz com diferentes formatos de pergunta e validação por questão.";
        case "interactive-path":
            return "O caminho possui passos heterogêneos e respostas dependentes de contexto.";
        case "code":
            return "A atividade exige interpretação ou geração de código.";
        case "discursive":
            return "A atividade exige produção textual contextual.";
    }
}
