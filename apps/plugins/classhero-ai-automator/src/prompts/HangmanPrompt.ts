import type {
    HangmanPuzzle,
} from "@classhero-cli/api-wrapper";
import type {
    ActivityContext,
} from "../contracts/activity.js";
import type {
    HangmanGuessEvidence,
    HangmanKnowledge,
} from "../executors/HangmanKnowledge.js";
import type {
    AIProviderRequest,
} from "../providers/contracts.js";

/**
 * Hardcoded instruction used for every AI-assisted hangman analysis.
 *
 * Previous AI candidates are never treated as truth. Only the mask and
 * `wrongCount` transitions returned by ClassHero are authoritative evidence.
 */
export const HANGMAN_SYSTEM_PROMPT = [
    "Resolva a palavra da forca do ClassHero usando somente hipóteses compatíveis com as evidências fornecidas.",
    "NÃO assuma que uma palavra sugerida anteriormente estava correta.",
    "A máscara atual retornada pelo ClassHero é a principal evidência positiva: letras visíveis estão corretas e nas posições corretas.",
    "A lista wrongLetters contém somente letras que fizeram o ClassHero aumentar wrongCount; portanto essas letras NÃO pertencem à palavra.",
    "A lista correctLetters contém letras confirmadas pela máscara sem aumento de wrongCount.",
    "O histórico de tentativas mostra maskBefore, maskAfter e wrongCountBefore/wrongCountAfter para cada letra enviada.",
    "Nunca retorne uma palavra que contradiga uma letra conhecida na máscara.",
    "Nunca retorne uma palavra que contenha uma letra de wrongLetters.",
    "Nunca repita uma palavra de rejectedCandidates.",
    "Use principalmente a dica, a quantidade exata de letras, a máscara atual, as evidências de tentativas e o contexto do material.",
    "A resposta deve ser UMA única palavra que satisfaça a quantidade de letras informada.",
    "Não inclua espaços, hífens, pontuação, explicações ou texto adicional no campo 'word'.",
    "Considere português brasileiro e palavras técnicas quando o contexto indicar.",
    "Retorne apenas o objeto estruturado solicitado.",
].join(" ");

/** Structured-output contract requested from every compatible AI provider. */
export const HANGMAN_OUTPUT_SCHEMA: Readonly<Record<string, unknown>> = {
    type: "object",
    properties: {
        word: {
            type: "string",
            minLength: 1,
            description: "Melhor palavra candidata compatível com todas as evidências atuais.",
        },
        confidence: {
            type: "number",
            minimum: 0,
            maximum: 1,
            description: "Confiança entre 0 e 1 na palavra sugerida.",
        },
    },
    required: [
        "word",
        "confidence",
    ],
    additionalProperties: false,
};

/** One parsed provider answer for a hangman round. */
export interface HangmanAIAnswer {
    readonly word: string;
    readonly confidence: number;
}

/** Builds the provider-neutral request used by {@link HangmanExecutor}. */
export function createHangmanProviderRequest(
    context: ActivityContext,
    puzzle: HangmanPuzzle,
    knowledge: HangmanKnowledge,
): AIProviderRequest {
    return {
        task: "hangman",
        activity: context,
        systemInstruction:
            HANGMAN_SYSTEM_PROMPT,
        input: {
            hint:
                puzzle.hint,
            wordLength:
                puzzle.word_length,
            mask:
                knowledge.mask,
            correctLetters: [
                ...knowledge.correctLetters,
            ],
            wrongLetters: [
                ...knowledge.wrongLetters,
            ],
            guessedLetters: [
                ...knowledge.guessedLetters,
            ],
            wrongCount:
                knowledge.wrongCount,
            attemptsLeft:
                knowledge.attemptsLeft,
            rejectedCandidates: [
                ...knowledge.rejectedCandidates,
            ],
            guessHistory:
                knowledge.guessHistory.map(
                    serializeEvidence,
                ),
            materialContext:
                buildMaterialContext(
                    context,
                ),
        },
        output: {
            kind: "json",
            description:
                "Palavra candidata compatível com a máscara, wrongCount e histórico de letras.",
            jsonSchema:
                HANGMAN_OUTPUT_SCHEMA,
        },
    };
}

/** Parses the generic provider result without depending on a provider SDK. */
export function parseHangmanAIAnswer(
    data: unknown,
): HangmanAIAnswer | undefined {
    if (!isRecord(data)) {
        return undefined;
    }

    const word =
        typeof data.word === "string"
            ? data.word.trim()
            : "";

    const confidence =
        typeof data.confidence ===
            "number"
            ? data.confidence
            : Number.NaN;

    if (
        word.length === 0 ||
        !Number.isFinite(
            confidence,
        ) ||
        confidence < 0 ||
        confidence > 1
    ) {
        return undefined;
    }

    return {
        word,
        confidence,
    };
}

function serializeEvidence(
    evidence: HangmanGuessEvidence,
): Readonly<Record<string, unknown>> {
    return {
        letter:
            evidence.letter,
        outcome:
            evidence.outcome,
        maskBefore:
            evidence.maskBefore,
        maskAfter:
            evidence.maskAfter,
        wrongCountBefore:
            evidence.wrongCountBefore,
        wrongCountAfter:
            evidence.wrongCountAfter,
        attemptsLeftAfter:
            evidence.attemptsLeftAfter,
    };
}

function buildMaterialContext(
    context: ActivityContext,
): Readonly<Record<string, unknown>> {
    const activity =
        context.activity;

    return {
        title:
            context.title,
        description:
            truncate(
                activity.description,
                4_000,
            ),
        content:
            truncate(
                activity.content,
                8_000,
            ),
        discipline:
            context.disciplineName ??
            null,
        mission:
            context.missionName ??
            null,
    };
}

function truncate(
    value: unknown,
    maximum: number,
): string {
    if (
        typeof value !== "string"
    ) {
        return "";
    }

    return value.length <= maximum
        ? value
        : `${value.slice(0, maximum)}…`;
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
