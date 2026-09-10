import { Api, createQuery } from "../client/Api.js";
import type { ApiClient } from "../client/ApiClient.js";
import type {
    AvailableGamesQuery,
    AvailableGamesResponse,
    GameCreditBalance,
    GameMode,
    HangmanGuessResponse,
    HangmanPuzzleRequest,
    HangmanPuzzleResponse,
    HangmanSubmitInput,
    HangmanSubmitResponse,
    MemoryGameResponse,
    MemorySubmitInput,
    MemorySubmitResponse,
    MemoryValidateInput,
    MemoryValidateResponse,
    MissionGameStartPayload,
    WordSearchGameResponse,
    WordSearchStartResponse,
    WordSearchSubmitInput,
    WordSearchSubmitResponse,
} from "../types/index.js";

/** Memory-game endpoints. The game can be solved without an AI provider. */
export class MemoryGames extends Api {
    start(payload: MissionGameStartPayload) {
        return this.request<MemoryGameResponse>("/games/memory", {
            method: "POST",
            body: JSON.stringify(payload),
        });
    }

    balance(sessionId: string) {
        return this.request<GameCreditBalance>(`/games/memory/balance${createQuery({ session_id: sessionId })}`);
    }

    validate(input: MemoryValidateInput) {
        return this.request<MemoryValidateResponse>("/games/memory/validate", {
            method: "POST",
            body: JSON.stringify(input),
        });
    }

    submit(input: MemorySubmitInput) {
        return this.request<MemorySubmitResponse>("/games/memory/submit", {
            method: "POST",
            body: JSON.stringify(input),
        });
    }
}

/** Word-search endpoints. The board is deterministic and does not require AI. */
export class WordSearchGames extends Api {
    /** Creates or obtains a word-search board for the selected material. */
    start(payload: MissionGameStartPayload) {
        return this.request<WordSearchGameResponse>("/games/word-search", {
            method: "POST",
            body: JSON.stringify(payload),
        });
    }

    regenerate(payload: MissionGameStartPayload) {
        return this.start(payload);
    }

    /** Marks a generated board as started on the ClassHero backend. */
    markStarted(gameId: string) {
        return this.request<WordSearchStartResponse>("/games/word-search/start", {
            method: "POST",
            body: JSON.stringify({ game_id: gameId }),
        });
    }

    balance(gameId: string) {
        return this.request<GameCreditBalance>(`/games/word-search/balance${createQuery({ game_id: gameId })}`);
    }

    submit(input: WordSearchSubmitInput) {
        return this.request<WordSearchSubmitResponse>("/games/word-search/submit", {
            method: "POST",
            body: JSON.stringify(input),
        });
    }
}

/** Hangman/forca endpoints. */
export class HangmanGames extends Api {
    puzzle(payload: HangmanPuzzleRequest) {
        return this.request<HangmanPuzzleResponse>("/games/forca/puzzle", {
            method: "POST",
            body: JSON.stringify(payload),
        });
    }

    nextPuzzle(
        materialId: string,
        excludeWords: string[],
        mode: GameMode = "desafio",
        themeMissionMaterialId?: string,
    ) {
        return this.puzzle({
            materialId,
            mode,
            excludeWords,
            ...(themeMissionMaterialId ? { themeMissionMaterialId } : {}),
        });
    }

    guess(letter: string, puzzleId: string) {
        return this.request<HangmanGuessResponse>("/games/forca/guess", {
            method: "POST",
            body: JSON.stringify({ letter, puzzleId }),
        });
    }

    submit(input: HangmanSubmitInput) {
        return this.request<HangmanSubmitResponse>("/games/forca/submit", {
            method: "POST",
            body: JSON.stringify(input),
        });
    }
}

/** Game discovery plus the three student game facades currently used by ClassHero. */
export class Games extends Api {
    readonly memory: MemoryGames;
    readonly wordSearch: WordSearchGames;
    readonly hangman: HangmanGames;

    constructor(client?: ApiClient) {
        super(client);
        this.memory = new MemoryGames(this.client);
        this.wordSearch = new WordSearchGames(this.client);
        this.hangman = new HangmanGames(this.client);
    }

    available(query: AvailableGamesQuery = {}) {
        return this.request<AvailableGamesResponse>(`/games/available${createQuery(query)}`);
    }
}
