import type { UnknownRecord } from "./common.js";

export type GameId = "memory" | "word-search" | "hangman" | (string & {});
export type GameMode = "estudo" | "foco" | "desafio" | (string & {});

export interface AvailableGamesQuery {
    [key: string]: string | number | boolean | null | undefined;
    materialId?: string;
    mode?: GameMode;
}

export interface AvailableGame extends UnknownRecord {
    id: GameId;
    title: string;
    source?: "builtin" | "material" | (string & {});
}

export interface AvailableGamesResponse extends UnknownRecord {
    games: AvailableGame[];
}

export interface MissionGameStartPayload extends UnknownRecord {
    materialId: string;
    mode: GameMode;
    themeMissionMaterialId?: string;
}

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
    material_id: string;
    context: string;
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
    content_id: string;
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
    content_id: string;
    material_id: string;
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

export interface HangmanPuzzleRequest extends MissionGameStartPayload {
    excludeWords?: string[];
}

export interface HangmanPuzzleSource extends UnknownRecord {
    material_id: string;
}

export interface HangmanPuzzle extends UnknownRecord {
    id: string;
    puzzle_id: string;
    hint: string;
    source: HangmanPuzzleSource;
    word_length: number;
    mask: string;
}

export interface HangmanPuzzleResponse extends UnknownRecord {
    puzzles: HangmanPuzzle[];
    puzzle: HangmanPuzzle;
    source_material_id: string;
    content_id: string;
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
    materialId: string;
    missionId: string;
    context: string;
    mode: GameMode;
    hintsUsed: number;
    time_seconds: number;
    bonusApplied: boolean;
    xpPreview: number;
    content_id: string;
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
