import type {
    GameMode,
} from "@classhero-cli/api-wrapper";

/** Score preview calculated by the current ClassHero hangman frontend rules. */
export interface HangmanXpPreview {
    readonly finalXp: number;
    readonly baseXp: number;
    readonly hintPenalty: number;
    readonly extraErrorPenalty: number;
    readonly multiplierApplied: boolean;
    readonly multiplier: number;
}

interface HangmanModeRule {
    readonly baseXp: number;
    readonly emergencyHintCost: number;
    readonly extraErrorPenaltyStart: number;
    readonly extraErrorPenalty: number;
    readonly minXp: number;
    readonly multiplierNoHint?: number;
}

/**
 * Rules mirrored from the ClassHero web client's current hangman component.
 *
 * Keeping this pure and isolated makes future backend/frontend rule changes
 * straightforward to update and test.
 */
const RULES: Readonly<Record<"estudo" | "foco" | "desafio", HangmanModeRule>> = {
    estudo: {
        baseXp: 0,
        emergencyHintCost: 0,
        extraErrorPenaltyStart: Number.POSITIVE_INFINITY,
        extraErrorPenalty: 0,
        minXp: 0,
    },
    foco: {
        baseXp: 100,
        emergencyHintCost: 10,
        extraErrorPenaltyStart: 3,
        extraErrorPenalty: 5,
        minXp: 30,
    },
    desafio: {
        baseXp: 100,
        emergencyHintCost: 15,
        extraErrorPenaltyStart: 2,
        extraErrorPenalty: 10,
        minXp: 40,
        multiplierNoHint: 1.5,
    },
};

/** Calculates the same `xpPreview`/bonus state sent by the ClassHero frontend. */
export function calculateHangmanXpPreview(
    mode: GameMode,
    wrongCount: number,
    hintsUsed: number,
    emergencyHintsUsed = 0,
): HangmanXpPreview {
    const normalizedMode = normalizeMode(mode);
    const rule = RULES[normalizedMode];

    const hintPenalty =
        Math.max(0, emergencyHintsUsed) *
        rule.emergencyHintCost;

    const extraErrorPenalty =
        rule.extraErrorPenaltyStart ===
        Number.POSITIVE_INFINITY
            ? 0
            : Math.max(
                0,
                wrongCount -
                    rule.extraErrorPenaltyStart,
            ) * rule.extraErrorPenalty;

    let xp =
        rule.baseXp -
        hintPenalty -
        extraErrorPenalty;

    let multiplier = 1;

    if (
        rule.multiplierNoHint !== undefined &&
        hintsUsed === 0
    ) {
        multiplier =
            rule.multiplierNoHint;
        xp *= multiplier;
    }

    return {
        finalXp: Math.max(
            rule.minXp,
            Math.round(xp),
        ),
        baseXp:
            rule.baseXp,
        hintPenalty,
        extraErrorPenalty,
        multiplierApplied:
            multiplier !== 1,
        multiplier,
    };
}

function normalizeMode(
    mode: GameMode,
): "estudo" | "foco" | "desafio" {
    switch (mode) {
        case "estudo":
            return "estudo";
        case "foco":
            return "foco";
        case "desafio":
            return "desafio";
        default:
            return "desafio";
    }
}
