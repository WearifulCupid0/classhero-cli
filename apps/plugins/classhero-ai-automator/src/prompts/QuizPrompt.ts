import type {
    QuizQuestion,
} from "@classhero-cli/api-wrapper";
import type {
    ActivityContext,
} from "../contracts/activity.js";
import type {
    AIProviderRequest,
} from "../providers/contracts.js";

export const QUIZ_SYSTEM_PROMPT = [
    "Resolva uma questão de quiz do ClassHero.",
    "Priorize os sourceParagraphs fornecidos pela própria atividade; use conhecimento geral somente quando eles não forem suficientes.",
    "Não invente alternativas, labels, relações ou fatos que não existam no contexto.",
    "Retorne a resposta somente no array 'answers' e siga rigorosamente a regra específica do tipo de questão enviada no campo responseRule.",
    "Para respostas discursivas, escreva de forma objetiva em um único parágrafo, sem listas, títulos ou quebras de linha.",
    "Para fill_in_blank, retorne apenas a palavra ou expressão curta que completa a lacuna, não a frase inteira.",
    "Não inclua justificativa dentro dos itens de 'answers'.",
    "Retorne apenas o objeto estruturado solicitado.",
].join(" ");

export const QUIZ_OUTPUT_SCHEMA: Readonly<Record<string, unknown>> = {
    type: "object",
    properties: {
        answers: {
            type: "array",
            minItems: 1,
            items: {
                type: "string",
                minLength: 1,
            },
            description: "Resposta no formato esperado pelo tipo da questão.",
        },
        confidence: {
            type: "number",
            minimum: 0,
            maximum: 1,
        },
    },
    required: [
        "answers",
        "confidence",
    ],
    additionalProperties: false,
};

export interface QuizAIAnswer {
    readonly answers: readonly string[];
    readonly confidence: number;
}

export function createQuizProviderRequest(
    context: ActivityContext,
    question: QuizQuestion,
): AIProviderRequest {
    return {
        task: "quiz",
        activity: context,
        systemInstruction:
            QUIZ_SYSTEM_PROMPT,
        input: {
            questionId:
                question.question_id,
            question:
                question.question,
            type:
                question.type,
            level:
                question.level,
            responseRule:
                responseRuleFor(
                    question,
                ),
            numberOfCorrectOptions:
                question.num_correct_options ??
                null,
            options:
                question.options.map(
                    (option) => ({
                        label:
                            option.label,
                        text:
                            option.text,
                    }),
                ),
            sourceParagraphs: [
                ...question.source_paragraphs,
            ],
            sourceMaterialTitle:
                question.source_material_title ??
                null,
            extra:
                question.extra,
        },
        output: {
            kind: "json",
            description:
                "Resposta normalizada para uma questão do ClassHero.",
            jsonSchema:
                QUIZ_OUTPUT_SCHEMA,
        },
    };
}

export function parseQuizAIAnswer(
    data: unknown,
): QuizAIAnswer | undefined {
    if (!isRecord(data)) {
        return undefined;
    }

    if (
        !Array.isArray(data.answers) ||
        !data.answers.every(
            (answer) =>
                typeof answer === "string" &&
                answer.trim().length > 0,
        )
    ) {
        return undefined;
    }

    const confidence =
        typeof data.confidence ===
            "number"
            ? data.confidence
            : Number.NaN;

    if (
        !Number.isFinite(
            confidence,
        ) ||
        confidence < 0 ||
        confidence > 1
    ) {
        return undefined;
    }

    return {
        answers:
            data.answers.map(
                (answer) =>
                    answer.trim(),
            ),
        confidence,
    };
}

function responseRuleFor(
    question: QuizQuestion,
): string {
    switch (
        String(
            question.type,
        ).toLowerCase()
    ) {
        case "true_false":
            return "Retorne exatamente um label existente nas alternativas, normalmente 'verdadeiro' ou 'falso'.";

        case "multiple_choice":
        case "single_select":
            return "Retorne exatamente um label existente nas alternativas.";

        case "multiple_select":
            return typeof question.num_correct_options === "number"
                ? `Retorne exatamente ${question.num_correct_options} labels de alternativas corretas.`
                : "Retorne somente os labels das alternativas corretas.";

        case "matching":
        case "association":
            return "Retorne um par por item no formato 'A-2', usando cada item de cada lado uma única vez.";

        case "ordering":
            return "Retorne todos os labels das alternativas na ordem correta, um item por posição do array.";

        case "fill_in_blank":
            return "Retorne um único item contendo somente a palavra ou expressão curta que completa a lacuna.";

        case "short_answer":
            return "Retorne um único item com uma resposta curta, objetiva e completa, escrita em exatamente um parágrafo sem quebras de linha.";

        default:
            return `O tipo '${question.type}' não possui uma regra conhecida; não invente um formato de resposta.`;
    }
}

function isRecord(
    value: unknown,
): value is Record<string, unknown> {
    return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
    );
}
