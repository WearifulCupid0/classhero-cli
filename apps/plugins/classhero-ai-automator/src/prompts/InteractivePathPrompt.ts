import type {
    GamifiedInteractivePath,
    GamifiedInteractivePathStep,
} from "@classhero-cli/api-wrapper";
import type { ActivityContext } from "../contracts/activity.js";
import type { AIProviderRequest } from "../providers/contracts.js";

/** Hardcoded instruction for `quick_quiz` steps inside a ClassHero Trilha. */
export const INTERACTIVE_PATH_SYSTEM_PROMPT = [
    "Resolva um passo quick_quiz de uma Trilha do ClassHero.",
    "Escolha exatamente uma das opções fornecidas.",
    "O campo selectedOptionId deve conter exatamente o id de uma opção existente.",
    "Use o título, prompt, resumo da trilha e opções para decidir.",
    "Não invente ids e não retorne explicações fora do objeto estruturado.",
    "Retorne apenas o objeto estruturado solicitado.",
].join(" ");

export const INTERACTIVE_PATH_OUTPUT_SCHEMA: Readonly<Record<string, unknown>> = {
    type: "object",
    properties: {
        selectedOptionId: {
            type: "string",
            minLength: 1,
            description: "Id exato da opção escolhida para o quick_quiz.",
        },
        confidence: {
            type: "number",
            minimum: 0,
            maximum: 1,
        },
    },
    required: ["selectedOptionId", "confidence"],
    additionalProperties: false,
};

export interface InteractivePathAIAnswer {
    readonly selectedOptionId: string;
    readonly confidence: number;
}

export function createInteractivePathProviderRequest(
    context: ActivityContext,
    path: GamifiedInteractivePath,
    step: GamifiedInteractivePathStep,
): AIProviderRequest {
    return {
        task: "interactive-path",
        activity: context,
        systemInstruction: INTERACTIVE_PATH_SYSTEM_PROMPT,
        input: {
            pathTitle: path.summary.title,
            pathDescription: path.summary.description,
            level: path.level_key,
            stepTitle: step.title,
            prompt: step.prompt,
            position: step.position,
            totalSteps: path.steps.length,
            options: (step.payload.options ?? []).map((option) => ({
                id: option.id,
                label: option.label,
                value: option.value,
            })),
        },
        output: {
            kind: "json",
            description: "Opção selecionada para um quick_quiz da Trilha.",
            jsonSchema: INTERACTIVE_PATH_OUTPUT_SCHEMA,
        },
    };
}

export function parseInteractivePathAIAnswer(
    data: unknown,
): InteractivePathAIAnswer | undefined {
    if (!isRecord(data)) {
        return undefined;
    }

    const selectedOptionId =
        typeof data.selectedOptionId === "string"
            ? data.selectedOptionId.trim()
            : "";
    const confidence =
        typeof data.confidence === "number"
            ? data.confidence
            : Number.NaN;

    if (
        selectedOptionId.length === 0 ||
        !Number.isFinite(confidence) ||
        confidence < 0 ||
        confidence > 1
    ) {
        return undefined;
    }

    return { selectedOptionId, confidence };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
