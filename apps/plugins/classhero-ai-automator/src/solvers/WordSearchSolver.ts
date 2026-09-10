import type {
    WordSearchFoundWord,
    WordSearchGameResponse,
    WordSearchPosition,
} from "@classhero-cli/api-wrapper";

/** One unresolved word reported by the deterministic solver. */
export interface UnresolvedWordSearchWord {
    readonly wordIndex: number;
    readonly word: string;
}

/** Complete deterministic word-search solution. */
export interface WordSearchSolution {
    readonly foundWords: readonly WordSearchFoundWord[];
    readonly unresolved: readonly UnresolvedWordSearchWord[];
}

interface Direction {
    readonly row: number;
    readonly col: number;
}

/** Eight legal straight-line directions used by ClassHero word-search boards. */
const DIRECTIONS: readonly Direction[] = [
    { row: -1, col: -1 },
    { row: -1, col: 0 },
    { row: -1, col: 1 },
    { row: 0, col: -1 },
    { row: 0, col: 1 },
    { row: 1, col: -1 },
    { row: 1, col: 0 },
    { row: 1, col: 1 },
];

/**
 * Pure deterministic ClassHero word-search solver.
 *
 * The algorithm is based on the supplied `caca-palavras.ts`: it normalizes
 * diacritics/case and searches every word from every cell in all eight
 * directions.
 */
export class WordSearchSolver {
    /** Solves every keyword returned by a ClassHero word-search game. */
    solve(game: WordSearchGameResponse): WordSearchSolution {
        validateBoard(game.array);

        const foundWords: WordSearchFoundWord[] = [];
        const unresolved: UnresolvedWordSearchWord[] = [];

        game.key_words.forEach((keyword, wordIndex) => {
            const path = this.findWord(game.array, keyword.original);

            if (!path) {
                unresolved.push({
                    wordIndex,
                    word: keyword.original,
                });
                return;
            }

            foundWords.push({
                wordIndex,
                path,
            });
        });

        return {
            foundWords,
            unresolved,
        };
    }

    /** Finds one word in the supplied board or returns `null` when absent. */
    findWord(
        board: readonly (readonly string[])[],
        word: string,
    ): WordSearchPosition[] | null {
        const rows = board.length;
        if (rows === 0) {
            return null;
        }

        const cols = board[0]?.length ?? 0;
        if (cols === 0) {
            return null;
        }

        const target = normalize(word);
        if (target.length === 0) {
            return null;
        }

        for (let startRow = 0; startRow < rows; startRow++) {
            for (let startCol = 0; startCol < cols; startCol++) {
                for (const direction of DIRECTIONS) {
                    const path: WordSearchPosition[] = [];
                    let found = true;

                    for (let index = 0; index < target.length; index++) {
                        const row = startRow + direction.row * index;
                        const col = startCol + direction.col * index;

                        if (
                            row < 0 ||
                            row >= rows ||
                            col < 0 ||
                            col >= cols
                        ) {
                            found = false;
                            break;
                        }

                        const cell = board[row]?.[col];
                        if (typeof cell !== "string" || normalize(cell) !== target[index]) {
                            found = false;
                            break;
                        }

                        path.push({ row, col });
                    }

                    if (found) {
                        return path;
                    }
                }
            }
        }

        return null;
    }
}

/** Normalizes Portuguese diacritics and case for board comparisons. */
export function normalizeWordSearchValue(value: string): string {
    return normalize(value);
}

function normalize(value: string): string {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase();
}

function validateBoard(board: readonly (readonly string[])[]): void {
    if (board.length === 0) {
        throw new Error("Word-search board is empty.");
    }

    const width = board[0]?.length ?? 0;
    if (width === 0) {
        throw new Error("Word-search board has no columns.");
    }

    if (board.some((row) => row.length !== width)) {
        throw new Error("Word-search board is not rectangular.");
    }
}
