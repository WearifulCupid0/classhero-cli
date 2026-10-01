import type {
    AnagramPuzzleResponse,
} from "@classhero-cli/api-wrapper";
import type {
    ActivityContext,
} from "../contracts/activity.js";
import type {
    AIProviderRequest,
} from "../providers/contracts.js";

export type AnagramCandidateFailureReason =
    | "local-validation"
    | "backend-rejected";

export interface AnagramCandidateFailure {
    readonly answer: string;
    readonly reason: AnagramCandidateFailureReason;
    readonly detail: string;
}

export interface AnagramAIAnswer {
    readonly answer: string;
    readonly confidence: number;
}

export interface AnagramAnswerValidation {
    readonly valid: boolean;
    readonly normalizedAnswer: string;
    readonly reason?: string;
}

export const ANAGRAM_SYSTEM_PROMPT = [
    "Resolva o Anagrama do ClassHero usando a dica, o contexto da atividade e exatamente as letras fornecidas em cada grupo embaralhado.",
    "Cada grupo corresponde a uma palavra e a resposta final deve preservar a mesma quantidade de grupos, separados por um único espaço.",
    "Não adicione, remova, troque ou mova letras entre grupos.",
    "failedCandidates contém respostas já rejeitadas localmente ou pelo próprio ClassHero; não repita essas respostas.",
    "O ClassHero é a fonte de verdade. Uma resposta rejeitada pelo backend deve ser tratada como incorreta, mesmo que pareça semanticamente plausível.",
    "Use somente o contexto fornecido e retorne apenas o objeto estruturado solicitado.",
].join(" ");

export const ANAGRAM_OUTPUT_SCHEMA: Readonly<Record<string, unknown>> = {
    type: "object",
    properties: {
        answer: {
            type: "string",
            minLength: 1,
        },
        confidence: {
            type: "number",
            minimum: 0,
            maximum: 1,
        },
    },
    required: [
        "answer",
        "confidence",
    ],
    additionalProperties: false,
};

export function createAnagramProviderRequest(
    context: ActivityContext,
    puzzle: AnagramPuzzleResponse,
    failures: readonly AnagramCandidateFailure[],
): AIProviderRequest {
    return {
        task: "anagram",
        activity: context,
        systemInstruction:
            ANAGRAM_SYSTEM_PROMPT,
        input: {
            puzzle: {
                hint:
                    puzzle.hint,
                scrambledGroups:
                    puzzle.scrambled_groups.map(
                        (group) => [
                            ...group,
                        ],
                    ),
                expectedGroupCount:
                    puzzle.scrambled_groups.length,
            },
            failedCandidates:
                failures.map(
                    (failure) => ({
                        answer:
                            failure.answer,
                        reason:
                            failure.reason,
                        detail:
                            failure.detail,
                    }),
                ),
            sourceContext:
                buildSourceContext(
                    context,
                ),
        },
        output: {
            kind: "json",
            description:
                "Uma única resposta para o anagrama, formada somente pelas letras disponíveis nos respectivos grupos.",
            jsonSchema:
                ANAGRAM_OUTPUT_SCHEMA,
        },
    };
}

export function parseAnagramAIAnswer(
    data: unknown,
): AnagramAIAnswer | undefined {
    if (!isRecord(data)) {
        return undefined;
    }

    const answer =
        typeof data.answer ===
        "string"
            ? data.answer.trim()
            : "";

    const confidence =
        typeof data.confidence ===
        "number"
            ? data.confidence
            : Number.NaN;

    if (
        answer.length === 0 ||
        !Number.isFinite(
            confidence,
        ) ||
        confidence < 0 ||
        confidence > 1
    ) {
        return undefined;
    }

    return {
        answer,
        confidence,
    };
}

/**
 * Normalizes whitespace/case and guarantees that every answer group is an
 * anagram of the corresponding server-provided scrambled group.
 */
export function validateAnagramAnswer(
    answer: string,
    puzzle: AnagramPuzzleResponse,
): AnagramAnswerValidation {
    const normalizedAnswer =
        normalizeAnswer(
            answer,
        );

    const groups =
        normalizedAnswer.length ===
        0
            ? []
            : normalizedAnswer.split(
                " ",
            );

    if (
        groups.length !==
        puzzle.scrambled_groups
            .length
    ) {
        return {
            valid: false,
            normalizedAnswer,
            reason:
                `A resposta possui ${groups.length} grupo(s), mas o puzzle exige ${puzzle.scrambled_groups.length}.`,
        };
    }

    for (
        let index = 0;
        index < groups.length;
        index++
    ) {
        const candidate =
            groups[index]!;
        const expected =
            puzzle.scrambled_groups[
                index
            ]!;

        if (
            !sameCharacterMultiset(
                candidate,
                expected,
            )
        ) {
            return {
                valid: false,
                normalizedAnswer,
                reason:
                    `O grupo ${index + 1} não usa exatamente as letras fornecidas pelo ClassHero.`,
            };
        }
    }

    return {
        valid: true,
        normalizedAnswer,
    };
}

function normalizeAnswer(
    value: string,
): string {
    return value
        .normalize("NFC")
        .trim()
        .replace(
            /\s+/g,
            " ",
        )
        .toLocaleUpperCase(
            "pt-BR",
        );
}

function sameCharacterMultiset(
    candidate: string,
    scrambled: readonly string[],
): boolean {
    const candidateCharacters =
        Array.from(
            candidate.normalize(
                "NFC",
            ),
        ).sort();

    const scrambledCharacters =
        scrambled
            .flatMap(
                (part) =>
                    Array.from(
                        part
                            .normalize(
                                "NFC",
                            )
                            .toLocaleUpperCase(
                                "pt-BR",
                            ),
                    ),
            )
            .sort();

    if (
        candidateCharacters.length !==
        scrambledCharacters.length
    ) {
        return false;
    }

    return candidateCharacters.every(
        (character, index) =>
            character ===
            scrambledCharacters[
                index
            ],
    );
}

function buildSourceContext(
    context: ActivityContext,
): Readonly<Record<string, unknown>> {
    const activity =
        context.targets.find(
            (target) =>
                target.capability ===
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
        typeof value !==
        "string"
    ) {
        return "";
    }

    return value.length <=
        maximum
        ? value
        : `${value.slice(0, maximum)}…`;
}

function isRecord(
    value: unknown,
): value is Record<string, unknown> {
    return (
        typeof value ===
            "object" &&
        value !== null &&
        !Array.isArray(value)
    );
}
