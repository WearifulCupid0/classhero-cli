import type {
    HangmanPuzzle,
} from "@classhero-cli/api-wrapper";
import type {
    ActivityContext,
} from "../contracts/activity.js";
import type {
    HangmanCandidateFailure,
    HangmanGuessEvidence,
    HangmanKnowledge,
} from "../executors/HangmanKnowledge.js";
import { getActivityTarget } from "../context/ActivityTargets.js";
import type {
    AIProviderRequest,
} from "../providers/contracts.js";

/**
 * Hardcoded instruction used for every AI-assisted hangman analysis.
 *
 * The prompt deliberately treats every model answer as a hypothesis. The
 * backend mask and wrongCount transitions are the only authoritative evidence.
 */
export const HANGMAN_SYSTEM_PROMPT = [
    "Resolva a palavra da forca do ClassHero usando somente hipóteses compatíveis com as evidências fornecidas.",
    "IMPORTANTE: sua resposta anterior pode estar errada. Nunca trate uma palavra sugerida anteriormente como verdadeira.",
    "O ClassHero é a fonte de verdade: a máscara atual mostra letras confirmadas nas posições corretas, e wrongCount indica quando uma letra enviada estava errada.",
    "failedCandidates contém palavras já comprovadas incorretas, a letra ou letras que falharam, a máscara resultante e a variação de wrongCount. Não repita essas palavras.",
    "wrongLetters contém letras que fizeram wrongCount aumentar. Nenhuma delas pode aparecer na nova palavra candidata.",
    "correctLetters contém letras confirmadas pela máscara sem aumento de wrongCount.",
    "guessedLetters contém todas as letras já enviadas ao ClassHero.",
    "guessHistory contém cada tentativa individual com maskBefore, maskAfter, wrongCountBefore e wrongCountAfter.",
    "A palavra retornada DEVE usar exclusivamente caracteres ASCII A-Z, sem acentos, cedilha, números, espaços, hífens, pontuação ou símbolos.",
    "Se o conceito normalmente tiver acento ou cedilha, normalize para A-Z. Exemplo: ACAO em vez de AÇÃO.",
    "A candidata deve possuir exatamente wordLength letras depois dessa normalização.",
    "Nunca retorne uma palavra que contradiga qualquer letra já revelada na máscara.",
    "Nunca retorne uma palavra presente em rejectedCandidates ou failedCandidates.",
    "Use principalmente a dica, o contexto do material, a máscara atual, as letras confirmadas, as letras erradas e o histórico de hipóteses falhas.",
    "Retorne somente o objeto estruturado solicitado, sem explicações adicionais.",
].join(" ");

/** Structured-output contract requested from every compatible AI provider. */
export const HANGMAN_OUTPUT_SCHEMA: Readonly<Record<string, unknown>> = {
    type: "object",
    properties: {
        word: {
            type: "string",
            pattern: "^[A-Z]+$",
            minLength: 1,
            description:
                "Uma única palavra candidata usando exclusivamente caracteres A-Z.",
        },
        confidence: {
            type: "number",
            minimum: 0,
            maximum: 1,
            description:
                "Confiança entre 0 e 1 na palavra sugerida.",
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
            rules: {
                allowedAlphabet:
                    "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
                asciiOnly:
                    true,
                exactWordLength:
                    puzzle.word_length,
                previousCandidatesAreHypotheses:
                    true,
                backendIsSourceOfTruth:
                    true,
            },
            puzzle: {
                hint:
                    puzzle.hint,
                wordLength:
                    puzzle.word_length,
            },
            currentState: {
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
            },
            rejectedCandidates: [
                ...knowledge.rejectedCandidates,
            ],
            failedCandidates:
                knowledge.candidateFailures.map(
                    serializeCandidateFailure,
                ),
            guessHistory:
                knowledge.guessHistory.map(
                    serializeEvidence,
                ),
            failureSummary:
                buildFailureSummary(
                    knowledge,
                ),
            materialContext:
                buildMaterialContext(
                    context,
                ),
        },
        output: {
            kind: "json",
            description:
                "Nova hipótese de palavra para a forca, obrigatoriamente em A-Z e compatível com todas as evidências.",
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

function serializeCandidateFailure(
    failure: HangmanCandidateFailure,
): Readonly<Record<string, unknown>> {
    return {
        candidate:
            failure.candidate,
        status:
            "incorrect",
        reason:
            failure.reason,
        detail:
            failure.detail,
        rejectedLetters: [
            ...failure.rejectedLetters,
        ],
        maskBefore:
            failure.maskBefore,
        maskAfter:
            failure.maskAfter,
        wrongCountBefore:
            failure.wrongCountBefore,
        wrongCountAfter:
            failure.wrongCountAfter,
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

/**
 * Produces an explicit natural-language summary in addition to structured
 * fields because this makes the retry evidence very salient to any provider.
 */
function buildFailureSummary(
    knowledge: HangmanKnowledge,
): readonly string[] {
    return knowledge.candidateFailures.map(
        (failure) => {
            const rejected =
                failure.rejectedLetters.length > 0
                    ? failure.rejectedLetters.join(
                        ", ",
                    )
                    : "nenhuma letra nova rejeitada";

            return [
                `A palavra '${failure.candidate}' está incorreta.`,
                `Letras não aceitas nesta hipótese: ${rejected}.`,
                `Máscara atual após a hipótese: ${failure.maskAfter}.`,
                `wrongCount: ${failure.wrongCountBefore} -> ${failure.wrongCountAfter}.`,
                `Motivo: ${failure.detail}`,
            ].join(" ");
        },
    );
}

function buildMaterialContext(
    context: ActivityContext,
): Readonly<Record<string, unknown>> {
    const activity =
        getActivityTarget(
            context,
            "games",
        )?.activity ??
        context.activity;

    return {
        activityTitle:
            context.title,
        gameMaterialTitle:
            activity.title,
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
