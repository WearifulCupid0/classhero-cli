import type {
    HangmanGuessResponse,
    HangmanPuzzle,
} from "@classhero-cli/api-wrapper";

/** Outcome inferred from the authoritative ClassHero state transition. */
export type HangmanGuessOutcome =
    | "correct"
    | "wrong"
    | "neutral";

/** Evidence collected from one `/games/forca/guess` request. */
export interface HangmanGuessEvidence {
    readonly letter: string;
    readonly outcome: HangmanGuessOutcome;
    readonly maskBefore: string;
    readonly maskAfter: string;
    readonly wrongCountBefore: number;
    readonly wrongCountAfter: number;
    readonly attemptsLeftAfter: number;
}

/** Why one AI word hypothesis was discarded. */
export type HangmanCandidateFailureReason =
    | "local-validation"
    | "backend-wrong-letter"
    | "did-not-complete";

/**
 * Explicit evidence attached to an incorrect AI word hypothesis.
 *
 * This structure is sent back to the provider on the next reasoning round so
 * the model does not have to infer which previous word failed or why.
 */
export interface HangmanCandidateFailure {
    /** Candidate after strict ClassHero-compatible A-Z normalization. */
    readonly candidate: string;
    readonly reason: HangmanCandidateFailureReason;
    readonly detail: string;
    /** Letters specifically proven wrong while testing this candidate. */
    readonly rejectedLetters: readonly string[];
    readonly maskBefore: string;
    readonly maskAfter: string;
    readonly wrongCountBefore: number;
    readonly wrongCountAfter: number;
}

/**
 * Knowledge accumulated while solving one hangman puzzle.
 *
 * `wrongLetters` are authoritative: a letter enters this set only when
 * ClassHero increments `wrongCount` for that concrete `/guess`.
 */
export interface HangmanKnowledge {
    readonly mask: string;
    readonly guessedLetters: readonly string[];
    readonly correctLetters: readonly string[];
    readonly wrongLetters: readonly string[];
    readonly wrongCount: number;
    readonly attemptsLeft: number;
    readonly guessHistory: readonly HangmanGuessEvidence[];
    readonly rejectedCandidates: readonly string[];
    readonly candidateFailures: readonly HangmanCandidateFailure[];
}

/** Result of checking one AI candidate against facts already proven by ClassHero. */
export interface HangmanCandidateValidation {
    readonly valid: boolean;
    readonly normalizedCandidate: string;
    readonly reason?: string;
}

/** Creates the initial knowledge state from the puzzle returned by ClassHero. */
export function createInitialHangmanKnowledge(
    puzzle: HangmanPuzzle,
): HangmanKnowledge {
    return {
        mask: puzzle.mask,
        guessedLetters: [],
        correctLetters: revealedLetters(
            puzzle.mask,
        ),
        wrongLetters: [],
        wrongCount: 0,
        attemptsLeft: 6,
        guessHistory: [],
        rejectedCandidates: [],
        candidateFailures: [],
    };
}

/**
 * Records one backend guess response and classifies it using `wrongCount`.
 *
 * A larger `wrongCount` is authoritative proof that the submitted letter was
 * wrong. If `wrongCount` stays unchanged and the mask changes, the letter was
 * useful/correct.
 */
export function applyHangmanGuess(
    knowledge: HangmanKnowledge,
    letter: string,
    response: HangmanGuessResponse,
): {
    readonly knowledge: HangmanKnowledge;
    readonly evidence: HangmanGuessEvidence;
} {
    const normalizedLetter =
        normalizeHangmanLetter(letter);

    const wrong =
        response.wrongCount >
        knowledge.wrongCount;

    const maskChanged =
        response.mask !==
        knowledge.mask;

    const outcome:
        HangmanGuessOutcome =
        wrong
            ? "wrong"
            : maskChanged
                ? "correct"
                : "neutral";

    const evidence:
        HangmanGuessEvidence = {
        letter:
            normalizedLetter,
        outcome,
        maskBefore:
            knowledge.mask,
        maskAfter:
            response.mask,
        wrongCountBefore:
            knowledge.wrongCount,
        wrongCountAfter:
            response.wrongCount,
        attemptsLeftAfter:
            response.attemptsLeft,
    };

    const guessedLetters =
        uniqueLetters([
            ...knowledge.guessedLetters,
            ...response.guessed,
            normalizedLetter,
        ]);

    const wrongLetters =
        outcome === "wrong"
            ? uniqueLetters([
                ...knowledge.wrongLetters,
                normalizedLetter,
            ])
            : [
                ...knowledge.wrongLetters,
            ];

    const correctLetters =
        uniqueLetters([
            ...knowledge.correctLetters,
            ...revealedLetters(
                response.mask,
            ),
            ...(outcome === "correct"
                ? [normalizedLetter]
                : []),
        ]).filter(
            (value) =>
                !wrongLetters.includes(
                    value,
                ),
        );

    return {
        knowledge: {
            mask:
                response.mask,
            guessedLetters,
            correctLetters,
            wrongLetters,
            wrongCount:
                response.wrongCount,
            attemptsLeft:
                response.attemptsLeft,
            guessHistory: [
                ...knowledge.guessHistory,
                evidence,
            ],
            rejectedCandidates: [
                ...knowledge.rejectedCandidates,
            ],
            candidateFailures: [
                ...knowledge.candidateFailures,
            ],
        },
        evidence,
    };
}

/**
 * Records one discarded word hypothesis together with the concrete reason.
 *
 * Duplicate candidate/reason/evidence combinations are not inserted twice.
 */
export function recordHangmanCandidateFailure(
    knowledge: HangmanKnowledge,
    failure: HangmanCandidateFailure,
): HangmanKnowledge {
    const candidate =
        normalizeCandidateWord(
            failure.candidate,
        );

    const normalizedFailure:
        HangmanCandidateFailure = {
        ...failure,
        candidate,
        rejectedLetters:
            uniqueLetters(
                failure.rejectedLetters,
            ),
    };

    const rejectedCandidates =
        candidate.length > 0 &&
        !knowledge.rejectedCandidates.includes(
            candidate,
        )
            ? [
                ...knowledge.rejectedCandidates,
                candidate,
            ]
            : [
                ...knowledge.rejectedCandidates,
            ];

    const duplicate =
        knowledge.candidateFailures.some(
            (current) =>
                current.candidate ===
                    normalizedFailure.candidate &&
                current.reason ===
                    normalizedFailure.reason &&
                current.wrongCountAfter ===
                    normalizedFailure.wrongCountAfter &&
                current.maskAfter ===
                    normalizedFailure.maskAfter,
        );

    return {
        ...knowledge,
        rejectedCandidates,
        candidateFailures:
            duplicate
                ? [
                    ...knowledge.candidateFailures,
                ]
                : [
                    ...knowledge.candidateFailures,
                    normalizedFailure,
                ],
    };
}

/**
 * Backwards-compatible shorthand used by older call sites.
 */
export function rejectHangmanCandidate(
    knowledge: HangmanKnowledge,
    candidate: string,
): HangmanKnowledge {
    return recordHangmanCandidateFailure(
        knowledge,
        {
            candidate,
            reason:
                "local-validation",
            detail:
                "A candidata foi descartada sem nova evidência do backend.",
            rejectedLetters: [],
            maskBefore:
                knowledge.mask,
            maskAfter:
                knowledge.mask,
            wrongCountBefore:
                knowledge.wrongCount,
            wrongCountAfter:
                knowledge.wrongCount,
        },
    );
}

/**
 * Validates a candidate against everything already proven by ClassHero.
 *
 * Provider text is first normalized to the only outbound alphabet allowed by
 * this executor: `A-Z`. Diacritics are removed and every other character,
 * including numbers, spaces, punctuation and symbols, is discarded.
 */
export function validateHangmanCandidate(
    candidate: string,
    puzzle: HangmanPuzzle,
    knowledge: HangmanKnowledge,
): HangmanCandidateValidation {
    const normalized =
        normalizeCandidateWord(
            candidate,
        );

    if (
        normalized.length === 0
    ) {
        return {
            valid: false,
            normalizedCandidate:
                normalized,
            reason:
                "a resposta não contém nenhuma letra válida no alfabeto A-Z",
        };
    }

    const letters =
        Array.from(
            normalized,
        );

    if (
        letters.length !==
        puzzle.word_length
    ) {
        return {
            valid: false,
            normalizedCandidate:
                normalized,
            reason:
                `quantidade de letras ${letters.length} diferente de ${puzzle.word_length}`,
        };
    }

    if (
        knowledge.rejectedCandidates.includes(
            normalized,
        )
    ) {
        return {
            valid: false,
            normalizedCandidate:
                normalized,
            reason:
                "a candidata já foi comprovada incorreta em uma análise anterior",
        };
    }

    const mask =
        maskCharacters(
            knowledge.mask,
        );

    if (
        mask.length ===
        letters.length
    ) {
        for (
            let index = 0;
            index < mask.length;
            index++
        ) {
            const known =
                mask[index];

            if (
                !known ||
                known === "_"
            ) {
                continue;
            }

            if (
                normalizeHangmanLetter(
                    known,
                ) !==
                normalizeHangmanLetter(
                    letters[index] ?? "",
                )
            ) {
                return {
                    valid: false,
                    normalizedCandidate:
                        normalized,
                    reason:
                        `a candidata contradiz a máscara na posição ${index + 1}`,
                };
            }
        }
    }

    const candidateLetterSet =
        new Set(
            letters.map(
                normalizeHangmanLetter,
            ),
        );

    const forbidden =
        knowledge.wrongLetters.find(
            (letter) =>
                candidateLetterSet.has(
                    normalizeHangmanLetter(
                        letter,
                    ),
                ),
        );

    if (forbidden) {
        return {
            valid: false,
            normalizedCandidate:
                normalized,
            reason:
                `a candidata contém a letra '${forbidden}', já comprovadamente errada pelo wrongCount`,
        };
    }

    return {
        valid: true,
        normalizedCandidate:
            normalized,
    };
}

/**
 * Returns unique A-Z letters from one candidate that have not been tested yet.
 */
export function candidateLettersToTry(
    candidate: string,
    knowledge: HangmanKnowledge,
): string[] {
    const used =
        new Set(
            knowledge.guessedLetters.map(
                normalizeHangmanLetter,
            ),
        );

    const result:
        string[] = [];

    for (
        const character of
            Array.from(
                normalizeCandidateWord(
                    candidate,
                ),
            )
    ) {
        const letter =
            normalizeHangmanLetter(
                character,
            );

        if (
            !isAsciiHangmanLetter(
                letter,
            ) ||
            used.has(letter)
        ) {
            continue;
        }

        used.add(letter);
        result.push(letter);
    }

    return result;
}

/**
 * Converts arbitrary provider text into the exact outbound alphabet A-Z.
 *
 * Examples:
 * - `AÇÃO` -> `ACAO`
 * - `node.js` -> `NODEJS`
 * - `API2` -> `API`
 */
export function normalizeCandidateWord(
    value: string,
): string {
    return value
        .normalize("NFD")
        .replace(
            /[\u0300-\u036f]/g,
            "",
        )
        .toLocaleUpperCase(
            "en-US",
        )
        .replace(
            /[^A-Z]/g,
            "",
        );
}

/** Converts one arbitrary character into exactly one ASCII A-Z letter. */
export function normalizeHangmanLetter(
    value: string,
): string {
    return value
        .normalize("NFD")
        .replace(
            /[\u0300-\u036f]/g,
            "",
        )
        .toLocaleUpperCase(
            "en-US",
        )
        .replace(
            /[^A-Z]/g,
            "",
        )
        .slice(
            0,
            1,
        );
}

/** Returns whether a value is exactly one ClassHero-compatible A-Z letter. */
export function isAsciiHangmanLetter(
    value: string,
): boolean {
    return /^[A-Z]$/.test(
        value,
    );
}

function revealedLetters(
    mask: string,
): string[] {
    return uniqueLetters(
        maskCharacters(mask)
            .filter(
                (character) =>
                    character !== "_",
            )
            .map(
                normalizeHangmanLetter,
            )
            .filter(Boolean),
    );
}

function maskCharacters(
    mask: string,
): string[] {
    return Array.from(
        mask.replace(
            /\s+/g,
            "",
        ),
    );
}

function uniqueLetters(
    values: readonly string[],
): string[] {
    const seen =
        new Set<string>();
    const result:
        string[] = [];

    for (const value of values) {
        const normalized =
            normalizeHangmanLetter(
                value,
            );

        if (
            !isAsciiHangmanLetter(
                normalized,
            ) ||
            seen.has(
                normalized,
            )
        ) {
            continue;
        }

        seen.add(
            normalized,
        );
        result.push(
            normalized,
        );
    }

    return result;
}
