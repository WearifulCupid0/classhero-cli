import type { UnknownRecord } from "./common.js";

export type GameId = "memory" | "word-search" | "hangman" | "anagram" | "quiz" | (string & {});
export type GameMode = "estudo" | "foco" | "desafio" | (string & {});

export interface AvailableGamesQuery {
    [key: string]: string | number | boolean | null | undefined;
    /**
     * ClassHero uses the same query parameter for material-scoped discovery
     * and, in the mission-bonus launcher, the mission/theme id itself.
     */
    materialId?: string;
    mode?: GameMode;
}

export interface AvailableGame extends UnknownRecord {
    id: GameId;
    title: string;
    source?: "builtin" | "material" | (string & {});
}

export interface AvailableGamesResponse extends UnknownRecord {
    /** Games currently available for the supplied material/mission context. */
    games: AvailableGame[];
}

/** Bonus games supported by the current mission launcher. */
export type MissionBonusGameId =
    | "memory"
    | "word-search"
    | "hangman";

/** Starts a mini-game attached to one concrete theme material. */
export interface MaterialGameStartPayload extends UnknownRecord {
    materialId: string;
    mode: GameMode;
    themeMissionMaterialId?: string;
}

/**
 * Starts a mission-level bonus mini-game.
 *
 * The sixth HAR confirms this shape for word-search and the ClassHero frontend
 * uses the same mission-scoped launcher for memory and hangman.
 */
export interface MissionGameStartPayload extends UnknownRecord {
    missionId: string;
    mode: GameMode;
}

/** Transport payload accepted by mini-game creation endpoints. */
export type GameStartPayload =
    | MaterialGameStartPayload
    | MissionGameStartPayload;

export interface PedagogicalCreditAward extends UnknownRecord {
    amount?: number;
    available_credits?: number;
    idempotent?: boolean;
}

export interface GameCreditBalance extends UnknownRecord {
    answer_reveal_cost: number;
    available_credits: number;
    hint_cost: number;
    mode: GameMode;
}

export interface MemoryGameCard extends UnknownRecord {
    id: string;
    content: string;
    face: string;
}

export interface MemoryGameGlossaryEntry extends UnknownRecord {
    word: string;
    definition: string;
}

export interface MemoryGameResponse extends UnknownRecord {
    session_id: string;
    cards: MemoryGameCard[];
    glossary: MemoryGameGlossaryEntry[];
    content_id: string;
}

export interface MemoryValidateInput {
    session_id: string;
    card_ids: string[];
}

export interface MemoryValidateResponse extends UnknownRecord {
    match: boolean;
}

export interface MemorySubmitInput extends UnknownRecord {
    session_id: string;
    score: number;
    matched_pairs: number;
    wrong_attempts: number;
    mode: GameMode;
    time_seconds: number;
    theme_id: string;
    /** Omitted by the frontend for mission-level bonus games. */
    material_id?: string;
    context: "material" | "mission" | (string & {});
    content_id: string;
}

export interface MemorySubmitResponse extends UnknownRecord {
    success: boolean;
    score: number;
    xp_awarded: number;
    content_id: string;
    message: string;
    attempt_id: string;
    pedagogical_credit_award: PedagogicalCreditAward | null;
}

export interface WordSearchKeyword extends UnknownRecord {
    original: string;
    hint?: string;
}

export interface WordSearchPosition {
    row: number;
    col: number;
}

export interface WordSearchFoundWord {
    wordIndex: number;
    path: WordSearchPosition[];
}

export interface WordSearchGameResponse extends UnknownRecord {
    game_id: string;
    key_words: WordSearchKeyword[];
    array: string[][];
    array_size: number;
    /** Mission-level word-search responses may omit this field. */
    content_id?: string;
}

export interface WordSearchStartInput {
    game_id: string;
}

export interface WordSearchStartResponse extends UnknownRecord {
    started_at: number;
}

export interface WordSearchSubmitInput extends UnknownRecord {
    game_id: string;
    found_words: WordSearchFoundWord[];
    mode: GameMode;
    hints_used: number;
    /** Omitted when the mission-scoped game response did not provide one. */
    content_id?: string;
    /** Material-scoped variant. */
    material_id?: string;
    /** Mission-scoped variant. */
    mission_id?: string;
}

export interface WordSearchSubmitResponse extends UnknownRecord {
    success: boolean;
    found_correct: number;
    found_without_help: number;
    peeked_found: number;
    revealed_count: number;
    total_words: number;
    time_seconds: number;
    score: number;
    xp_awarded: number;
    already_rewarded: boolean;
    content_id: string;
    message: string;
    attempt_id: string;
    pedagogical_credit_award: PedagogicalCreditAward | null;
}

export type HangmanPuzzleRequest =
    | (MaterialGameStartPayload & {
        excludeWords?: string[];
    })
    | (MissionGameStartPayload & {
        excludeWords?: string[];
    });

export interface HangmanPuzzleSource extends UnknownRecord {
    material_id?: string;
}

export interface HangmanPuzzle extends UnknownRecord {
    id: string;
    puzzle_id: string;
    hint: string;
    source?: HangmanPuzzleSource;
    word_length: number;
    mask: string;
}

export interface HangmanPuzzleResponse extends UnknownRecord {
    puzzles: HangmanPuzzle[];
    puzzle: HangmanPuzzle;
    source_material_id?: string;
    content_id?: string;
}

export interface HangmanGuessInput {
    puzzleId: string;
    letter: string;
}

export interface HangmanGuessResponse extends UnknownRecord {
    puzzle_id: string;
    hint: string;
    mask: string;
    guessed: string[];
    wrongCount: number;
    attemptsLeft: number;
    won: boolean;
    lost: boolean;
    revealed_word?: string;
}

export interface HangmanSubmitInput extends UnknownRecord {
    puzzleId: string;
    won: boolean;
    attempts: number;
    materialId?: string;
    missionId: string;
    context: "material" | "mission" | (string & {});
    mode: GameMode;
    hintsUsed: number;
    time_seconds: number;
    bonusApplied: boolean;
    xpPreview: number;
    content_id?: string;
    clientGameStatus: string;
}

export interface HangmanSubmitResponse extends UnknownRecord {
    success: boolean;
    score: number;
    xp_awarded: number;
    won: boolean;
    revealed_word: string;
    content_id: string;
    message: string;
    attempt_id: string;
    pedagogical_credit_award: PedagogicalCreditAward | null;
}


/**
 * Request used to obtain an Anagram puzzle.
 *
 * The fifth HAR confirms the same material/mode/source payload used by the
 * embedded game panel for the other material-linked mini-games.
 */
export type AnagramPuzzleRequest = MaterialGameStartPayload;

/**
 * Minimal successful puzzle shape read by the current ClassHero frontend.
 *
 * A successful response has not yet been captured because the backend reports
 * that no prepared Anagram content exists. These fields are nevertheless
 * confirmed by the shipped frontend component itself.
 */
export interface AnagramPuzzleResponse extends UnknownRecord {
    puzzle_id: string;
    /** Each nested array is one scrambled word/group displayed to the user. */
    scrambled_groups: string[][];
    hint: string;
    content_id: string;
}

/** Credit balance queried by the Anagram UI outside Study mode. */
export interface AnagramBalanceResponse extends UnknownRecord {
    available_credits: number;
}

/** Body submitted when the user asks the Anagram for one revealed position. */
export interface AnagramRevealLetterInput {
    puzzleId: string;
}

/** Position revealed by the ClassHero Anagram helper endpoint. */
export interface AnagramRevealLetterResponse extends UnknownRecord {
    word_index: number;
    position: number;
    letter: string;
    revealed_count: number;
    emergency?: boolean;
    penalty_points?: number;
    balance?: {
        available_credits: number;
        [key: string]: unknown;
    };
}

/**
 * Final/full-term Anagram submission used by the current web client.
 *
 * `answer` is built by joining each reordered scrambled group into a word and
 * then joining the words with one space.
 */
export interface AnagramSubmitInput extends UnknownRecord {
    puzzleId: string;
    answer: string;
    materialId?: string;
    missionId: string;
    context: "material" | "mission" | (string & {});
    mode: GameMode;
    time_seconds: number;
    hintsUsed: number;
    bonusApplied: boolean;
    xpPreview: number;
    content_id: string;
    clientGameStatus: string;
}

/**
 * Fields consumed by the current Anagram frontend after `/submit`.
 *
 * Optionality reflects that both incorrect submissions and final successful
 * submissions are handled by the same endpoint.
 */
export interface AnagramSubmitResponse extends UnknownRecord {
    attempt_id?: string;
    won: boolean;
    wrong_submit_count?: number;
    message?: string;
    revealed_term?: string;
    allow_retry?: boolean;
    xp_awarded?: number;
    score?: number;
    pedagogical_credit_award?: PedagogicalCreditAward | null;
}
