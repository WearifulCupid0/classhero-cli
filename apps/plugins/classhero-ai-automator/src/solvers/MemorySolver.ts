import type {
    MemoryGameCard,
    MemoryGameGlossaryEntry,
    MemoryGameResponse,
} from "@classhero-cli/api-wrapper";

/** One deterministic word/definition pair identified in the memory board. */
export interface MemoryPair {
    readonly wordCardId: string;
    readonly definitionCardId: string;
    readonly word: string;
    readonly definition: string;
}

/** Glossary entry that could not be mapped to two cards. */
export interface UnresolvedMemoryPair {
    readonly word: string;
    readonly definition: string;
}

/** Complete deterministic memory-game mapping. */
export interface MemorySolution {
    readonly pairs: readonly MemoryPair[];
    readonly unresolved: readonly UnresolvedMemoryPair[];
}

/**
 * Pure deterministic ClassHero memory-game solver.
 *
 * ClassHero returns both the shuffled cards and a glossary containing the
 * exact word/definition relations. Therefore no model inference is required:
 * the solver maps glossary text back to card ids.
 */
export class MemorySolver {
    /** Resolves all glossary entries into card-id pairs. */
    solve(game: MemoryGameResponse): MemorySolution {
        return this.solveCards(game.cards, game.glossary);
    }

    /** Resolves card/glossary collections without performing HTTP requests. */
    solveCards(
        cards: readonly MemoryGameCard[],
        glossary: readonly MemoryGameGlossaryEntry[],
    ): MemorySolution {
        const wordCards = indexCards(cards, "word");
        const definitionCards = indexCards(cards, "definition");

        const pairs: MemoryPair[] = [];
        const unresolved: UnresolvedMemoryPair[] = [];

        for (const entry of glossary) {
            const word = takeCard(wordCards, normalize(entry.word));
            const definition = takeCard(
                definitionCards,
                normalize(entry.definition),
            );

            if (!word || !definition) {
                unresolved.push({
                    word: entry.word,
                    definition: entry.definition,
                });
                continue;
            }

            pairs.push({
                wordCardId: word.id,
                definitionCardId: definition.id,
                word: entry.word,
                definition: entry.definition,
            });
        }

        return {
            pairs,
            unresolved,
        };
    }
}

function indexCards(
    cards: readonly MemoryGameCard[],
    face: string,
): Map<string, MemoryGameCard[]> {
    const result = new Map<string, MemoryGameCard[]>();

    for (const card of cards) {
        if (card.face.toLowerCase() !== face) {
            continue;
        }

        const key = normalize(card.content);
        const bucket = result.get(key) ?? [];
        bucket.push(card);
        result.set(key, bucket);
    }

    return result;
}

function takeCard(
    index: Map<string, MemoryGameCard[]>,
    key: string,
): MemoryGameCard | undefined {
    const bucket = index.get(key);
    const card = bucket?.shift();

    if (bucket?.length === 0) {
        index.delete(key);
    }

    return card;
}

function normalize(value: string): string {
    return value
        .normalize("NFKC")
        .trim()
        .replace(/\s+/g, " ")
        .toLocaleLowerCase("pt-BR");
}
