import type {
    HangmanPuzzle,
} from "@classhero-cli/api-wrapper";
import type {
    GameExecutionScope,
} from "../contracts/game-scope.js";
import type {
    HangmanCandidateFailure,
    HangmanGuessEvidence,
    HangmanKnowledge,
} from "../executors/HangmanKnowledge.js";
import type {
    AIProviderRequest,
} from "../providers/contracts.js";

export const HANGMAN_SYSTEM_PROMPT = [
    "Resolva a palavra da forca do ClassHero usando somente hipóteses compatíveis com as evidências fornecidas.",
    "Cada palavra sugerida é apenas uma hipótese; nunca assuma que uma hipótese anterior estava correta.",
    "O ClassHero é a fonte de verdade: a máscara atual confirma posições e um aumento de wrongCount prova que a letra enviada não pertence à palavra.",
    "failedCandidates contém palavras já comprovadas incorretas, as letras rejeitadas e o estado resultante. Não repita essas palavras.",
    "wrongLetters nunca podem aparecer na próxima candidata. correctLetters e a máscara devem ser respeitadas.",
    "A palavra retornada deve usar exclusivamente ASCII A-Z, sem acentos, cedilha, números, espaços, hífens, pontuação ou símbolos.",
    "Se a grafia normal tiver acento/cedilha, normalize para A-Z, por exemplo ACAO em vez de AÇÃO.",
    "A candidata deve possuir exatamente wordLength letras depois da normalização.",
    "Use a dica, o contexto disponível, a máscara, as letras já testadas e todo o histórico de falhas.",
    "Retorne somente o objeto estruturado solicitado.",
].join(" ");

export const HANGMAN_OUTPUT_SCHEMA: Readonly<Record<string, unknown>> = {
    type: "object",
    properties: {
        word: {
            type: "string",
            pattern: "^[A-Z]+$",
            minLength: 1,
        },
        confidence: {
            type: "number",
            minimum: 0,
            maximum: 1,
        },
    },
    required: ["word", "confidence"],
    additionalProperties: false,
};

export interface HangmanAIAnswer {
    readonly word: string;
    readonly confidence: number;
}

export function createHangmanProviderRequest(
    scope: GameExecutionScope,
    puzzle: HangmanPuzzle,
    knowledge: HangmanKnowledge,
): AIProviderRequest {
    return {
        task: "hangman",
        ...(scope.kind === "material"
            ? { activity: scope.activity }
            : { mission: scope.mission }),
        systemInstruction: HANGMAN_SYSTEM_PROMPT,
        input: {
            scope: scope.kind,
            rules: {
                allowedAlphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
                asciiOnly: true,
                exactWordLength: puzzle.word_length,
                previousCandidatesAreHypotheses: true,
                backendIsSourceOfTruth: true,
            },
            puzzle: {
                hint: puzzle.hint,
                wordLength: puzzle.word_length,
            },
            currentState: {
                mask: knowledge.mask,
                correctLetters: [...knowledge.correctLetters],
                wrongLetters: [...knowledge.wrongLetters],
                guessedLetters: [...knowledge.guessedLetters],
                wrongCount: knowledge.wrongCount,
                attemptsLeft: knowledge.attemptsLeft,
            },
            rejectedCandidates: [...knowledge.rejectedCandidates],
            failedCandidates: knowledge.candidateFailures.map(serializeCandidateFailure),
            guessHistory: knowledge.guessHistory.map(serializeEvidence),
            failureSummary: buildFailureSummary(knowledge),
            sourceContext: buildSourceContext(scope),
        },
        output: {
            kind: "json",
            description: "Nova hipótese A-Z compatível com todas as evidências atuais da forca.",
            jsonSchema: HANGMAN_OUTPUT_SCHEMA,
        },
    };
}

export function parseHangmanAIAnswer(
    data: unknown,
): HangmanAIAnswer | undefined {
    if (!isRecord(data)) {
        return undefined;
    }

    const word = typeof data.word === "string" ? data.word.trim() : "";
    const confidence = typeof data.confidence === "number" ? data.confidence : Number.NaN;

    if (
        word.length === 0 ||
        !Number.isFinite(confidence) ||
        confidence < 0 ||
        confidence > 1
    ) {
        return undefined;
    }

    return { word, confidence };
}

function buildSourceContext(
    scope: GameExecutionScope,
): Readonly<Record<string, unknown>> {
    if (scope.kind === "mission") {
        return {
            kind: "mission-bonus",
            missionTitle: scope.mission.title,
            discipline: scope.mission.disciplineName ?? null,
        };
    }

    const activity = scope.activity.targets.find(
        (target) => target.capability === "games",
    )?.activity ?? scope.activity.activity;

    return {
        kind: "material",
        activityTitle: scope.activity.title,
        gameMaterialTitle: activity.title,
        description: truncate(activity.description, 4_000),
        content: truncate(activity.content, 8_000),
        discipline: scope.activity.disciplineName ?? null,
        mission: scope.activity.missionName ?? null,
    };
}

function serializeCandidateFailure(
    failure: HangmanCandidateFailure,
): Readonly<Record<string, unknown>> {
    return {
        candidate: failure.candidate,
        status: "incorrect",
        reason: failure.reason,
        detail: failure.detail,
        rejectedLetters: [...failure.rejectedLetters],
        maskBefore: failure.maskBefore,
        maskAfter: failure.maskAfter,
        wrongCountBefore: failure.wrongCountBefore,
        wrongCountAfter: failure.wrongCountAfter,
    };
}

function serializeEvidence(
    evidence: HangmanGuessEvidence,
): Readonly<Record<string, unknown>> {
    return {
        letter: evidence.letter,
        outcome: evidence.outcome,
        maskBefore: evidence.maskBefore,
        maskAfter: evidence.maskAfter,
        wrongCountBefore: evidence.wrongCountBefore,
        wrongCountAfter: evidence.wrongCountAfter,
        attemptsLeftAfter: evidence.attemptsLeftAfter,
    };
}

function buildFailureSummary(
    knowledge: HangmanKnowledge,
): readonly string[] {
    return knowledge.candidateFailures.map((failure) => {
        const rejected = failure.rejectedLetters.length > 0
            ? failure.rejectedLetters.join(", ")
            : "nenhuma letra nova rejeitada";

        return [
            `A palavra '${failure.candidate}' está incorreta.`,
            `Letras não aceitas nesta hipótese: ${rejected}.`,
            `Máscara atual após a hipótese: ${failure.maskAfter}.`,
            `wrongCount: ${failure.wrongCountBefore} -> ${failure.wrongCountAfter}.`,
            `Motivo: ${failure.detail}`,
        ].join(" ");
    });
}

function truncate(
    value: unknown,
    maximum: number,
): string {
    if (typeof value !== "string") {
        return "";
    }

    return value.length <= maximum
        ? value
        : `${value.slice(0, maximum)}…`;
}

function isRecord(
    value: unknown,
): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
