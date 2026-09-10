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

/**
 * Knowledge accumulated while solving one hangman puzzle.
 *
 * `wrongLetters` are not guessed heuristically: a letter enters this set only
 * when ClassHero increments `wrongCount` after that concrete guess.
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
}

/** Result of checking one AI candidate against facts already proven by ClassHero. */
export interface HangmanCandidateValidation {
    readonly valid: boolean;
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
        normalizeLetter(letter);

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
        },
        evidence,
    };
}

/** Adds a candidate to the immutable rejected-candidate history. */
export function rejectHangmanCandidate(
    knowledge: HangmanKnowledge,
    candidate: string,
): HangmanKnowledge {
    const normalized =
        normalizeCandidateWord(
            candidate,
        );

    if (
        normalized.length === 0 ||
        knowledge.rejectedCandidates.includes(
            normalized,
        )
    ) {
        return knowledge;
    }

    return {
        ...knowledge,
        rejectedCandidates: [
            ...knowledge.rejectedCandidates,
            normalized,
        ],
    };
}

/**
 * Validates a candidate against everything already proven by ClassHero.
 *
 * This prevents wasting attempts on words that contradict the current mask or
 * contain letters that have already increased `wrongCount`.
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

    const letters =
        Array.from(normalized);

    if (
        letters.length !==
        puzzle.word_length
    ) {
        return {
            valid: false,
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
            reason:
                "a candidata já foi descartada em uma análise anterior",
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
                normalizeLetter(
                    known,
                ) !==
                normalizeLetter(
                    letters[index] ?? "",
                )
            ) {
                return {
                    valid: false,
                    reason:
                        `a candidata contradiz a máscara na posição ${index + 1}`,
                };
            }
        }
    }

    const candidateLetterSet =
        new Set(
            letters.map(
                normalizeLetter,
            ),
        );

    const forbidden =
        knowledge.wrongLetters.find(
            (letter) =>
                candidateLetterSet.has(
                    normalizeLetter(
                        letter,
                    ),
                ),
        );

    if (forbidden) {
        return {
            valid: false,
            reason:
                `a candidata contém a letra '${forbidden}', já comprovadamente errada pelo wrongCount`,
        };
    }

    return {
        valid: true,
    };
}

/**
 * Returns unique candidate letters that have not been tested yet.
 *
 * The executor stops at the first newly-proven wrong letter and asks the AI
 * for another word rather than blindly finishing the previous candidate.
 */
export function candidateLettersToTry(
    candidate: string,
    knowledge: HangmanKnowledge,
): string[] {
    const used =
        new Set(
            knowledge.guessedLetters.map(
                normalizeLetter,
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
            normalizeLetter(
                character,
            );

        if (
            letter.length !== 1 ||
            used.has(letter)
        ) {
            continue;
        }

        used.add(letter);
        result.push(letter);
    }

    return result;
}

/** Normalizes one provider candidate for comparison/submission planning. */
export function normalizeCandidateWord(
    value: string,
): string {
    return Array.from(
        value.normalize("NFC"),
    )
        .filter(
            (character) =>
                /\p{L}/u.test(
                    character,
                ),
        )
        .join("")
        .toLocaleUpperCase(
            "pt-BR",
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
                normalizeLetter,
            )
            .filter(Boolean),
    );
}

function maskCharacters(
    mask: string,
): string[] {
    return Array.from(
        mask
            .replace(
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
            normalizeLetter(
                value,
            );

        if (
            normalized.length !== 1 ||
            seen.has(normalized)
        ) {
            continue;
        }

        seen.add(normalized);
        result.push(normalized);
    }

    return result;
}

function normalizeLetter(
    value: string,
): string {
    return value
        .normalize("NFD")
        .replace(
            /[\u0300-\u036f]/g,
            "",
        )
        .toLocaleUpperCase(
            "pt-BR",
        )
        .replace(
            /[^A-ZÇ]/g,
            "",
        )
        .slice(0, 1);
}
