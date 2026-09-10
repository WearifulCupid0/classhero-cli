import type {
    QuizQuestion,
} from "@classhero-cli/api-wrapper";

export interface NormalizedQuizAnswer {
    readonly ok: true;
    readonly answers: readonly string[];
}

export interface InvalidQuizAnswer {
    readonly ok: false;
    readonly reason: string;
}

export type QuizAnswerNormalizationResult =
    | NormalizedQuizAnswer
    | InvalidQuizAnswer;

/**
 * Final type-specific guard between provider output and ClassHero submission.
 */
export function normalizeQuizAnswer(
    question: QuizQuestion,
    rawAnswers: readonly string[],
): QuizAnswerNormalizationResult {
    const answers =
        unique(
            rawAnswers
                .map(
                    normalizeText,
                )
                .filter(Boolean),
        );

    if (answers.length === 0) {
        return invalid(
            "a IA retornou uma resposta vazia",
        );
    }

    const type =
        String(
            question.type,
        ).toLowerCase();

    const labels =
        question.options.map(
            (option) =>
                option.label.trim(),
        );

    switch (type) {
        case "single_select":
        case "multiple_choice":
        case "true_false": {
            if (answers.length !== 1) {
                return invalid(
                    `o tipo '${type}' exige exatamente uma resposta`,
                );
            }

            if (labels.length === 0) {
                return valid([
                    answers[0]!,
                ]);
            }

            const canonical =
                canonicalLabel(
                    answers[0]!,
                    labels,
                );

            return canonical === undefined
                ? invalid(
                    `a resposta '${answers[0]}' não corresponde a nenhum label de alternativa`,
                )
                : valid([
                    canonical,
                ]);
        }

        case "multiple_select": {
            const canonical =
                canonicalLabels(
                    answers,
                    labels,
                );

            if (!canonical.ok) {
                return canonical;
            }

            const expected =
                question.num_correct_options;

            if (
                typeof expected ===
                    "number" &&
                expected > 0 &&
                canonical.answers.length !==
                    expected
            ) {
                return invalid(
                    `a questão informa ${expected} alternativas corretas, mas a IA retornou ${canonical.answers.length}`,
                );
            }

            return canonical;
        }

        case "matching":
        case "association":
            return normalizeMatching(
                question,
                answers,
            );

        case "ordering": {
            const canonical =
                canonicalLabels(
                    answers,
                    labels,
                );

            if (!canonical.ok) {
                return canonical;
            }

            if (
                labels.length > 0 &&
                canonical.answers.length !==
                    labels.length
            ) {
                return invalid(
                    `a ordenação precisa conter ${labels.length} itens, mas recebeu ${canonical.answers.length}`,
                );
            }

            return canonical;
        }

        case "fill_in_blank":
            return answers.length === 1
                ? valid([
                    collapseToSingleLine(
                        answers[0]!,
                    ),
                ])
                : invalid(
                    "fill_in_blank exige uma única palavra ou expressão curta",
                );

        case "short_answer":
            return answers.length === 1
                ? valid([
                    collapseToSingleParagraph(
                        answers[0]!,
                    ),
                ])
                : invalid(
                    "short_answer exige uma única resposta textual",
                );

        default:
            return invalid(
                `o tipo de questão '${question.type}' ainda não possui normalizador seguro`,
            );
    }
}

function normalizeMatching(
    question: QuizQuestion,
    answers: readonly string[],
): QuizAnswerNormalizationResult {
    const left =
        question.options
            .map(
                (option) =>
                    option.label.trim(),
            )
            .filter(
                (label) =>
                    /^[A-Za-z]$/.test(
                        label,
                    ),
            );

    const right =
        question.options
            .map(
                (option) =>
                    option.label.trim(),
            )
            .filter(
                (label) =>
                    /^\d+$/.test(
                        label,
                    ),
            );

    if (
        left.length > 0 &&
        answers.length !==
            left.length
    ) {
        return invalid(
            `a associação exige ${left.length} pares, mas recebeu ${answers.length}`,
        );
    }

    const usedLeft =
        new Set<string>();
    const usedRight =
        new Set<string>();
    const normalized:
        string[] = [];

    for (const answer of answers) {
        const match =
            /^([A-Za-z])\s*[-:]\s*(\d+)$/i.exec(
                answer,
            );

        if (!match) {
            return invalid(
                `o par '${answer}' não está no formato A-2`,
            );
        }

        const leftLabel =
            canonicalLabel(
                match[1]!,
                left,
            );

        const rightLabel =
            canonicalLabel(
                match[2]!,
                right,
            );

        if (
            leftLabel === undefined ||
            rightLabel === undefined
        ) {
            return invalid(
                `o par '${answer}' utiliza um label que não existe na questão`,
            );
        }

        if (
            usedLeft.has(
                leftLabel,
            ) ||
            usedRight.has(
                rightLabel,
            )
        ) {
            return invalid(
                "a associação reutiliza um item mais de uma vez",
            );
        }

        usedLeft.add(
            leftLabel,
        );
        usedRight.add(
            rightLabel,
        );
        normalized.push(
            `${leftLabel}-${rightLabel}`,
        );
    }

    return valid(
        normalized,
    );
}

function canonicalLabels(
    answers: readonly string[],
    labels: readonly string[],
): QuizAnswerNormalizationResult {
    if (labels.length === 0) {
        return valid(
            answers,
        );
    }

    const result:
        string[] = [];

    for (const answer of answers) {
        const canonical =
            canonicalLabel(
                answer,
                labels,
            );

        if (canonical === undefined) {
            return invalid(
                `a resposta '${answer}' não corresponde a nenhum label disponível`,
            );
        }

        result.push(
            canonical,
        );
    }

    return valid(
        unique(result),
    );
}

function canonicalLabel(
    value: string,
    labels: readonly string[],
): string | undefined {
    const normalized =
        value
            .trim()
            .toLocaleLowerCase(
                "pt-BR",
            );

    return labels.find(
        (label) =>
            label
                .trim()
                .toLocaleLowerCase(
                    "pt-BR",
                ) ===
            normalized,
    );
}

function collapseToSingleLine(
    value: string,
): string {
    return value
        .replace(
            /\s+/g,
            " ",
        )
        .trim();
}

function collapseToSingleParagraph(
    value: string,
): string {
    return collapseToSingleLine(
        value,
    );
}

function normalizeText(
    value: string,
): string {
    return value.trim();
}

function unique(
    values: readonly string[],
): string[] {
    return [
        ...new Set(
            values,
        ),
    ];
}

function valid(
    answers: readonly string[],
): NormalizedQuizAnswer {
    return {
        ok: true,
        answers,
    };
}

function invalid(
    reason: string,
): InvalidQuizAnswer {
    return {
        ok: false,
        reason,
    };
}
