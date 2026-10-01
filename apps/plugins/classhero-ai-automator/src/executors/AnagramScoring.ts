import type { GameMode } from "@classhero-cli/api-wrapper";

export interface AnagramXpPreview {
    readonly finalXp: number;
    readonly baseXp: number;
    readonly hintPenalty: number;
    readonly extraErrorPenalty: number;
    readonly multiplierApplied: boolean;
    readonly multiplier: number;
}

interface AnagramScoringRule {
    readonly baseXp: number;
    readonly minXp: number;
    readonly emergencyHintPenalty: number;
    readonly extraWrongSubmitPenaltyStart: number;
    readonly extraWrongSubmitPenalty: number;
    readonly multiplierNoHint?: number;
}

const RULES: Readonly<Record<"estudo" | "foco" | "desafio", AnagramScoringRule>> = {
    estudo: {
        baseXp: 0,
        minXp: 0,
        emergencyHintPenalty: 0,
        extraWrongSubmitPenaltyStart: Number.POSITIVE_INFINITY,
        extraWrongSubmitPenalty: 0,
    },
    foco: {
        baseXp: 100,
        minXp: 30,
        emergencyHintPenalty: 10,
        extraWrongSubmitPenaltyStart: 3,
        extraWrongSubmitPenalty: 5,
    },
    desafio: {
        baseXp: 100,
        minXp: 40,
        emergencyHintPenalty: 15,
        extraWrongSubmitPenaltyStart: 2,
        extraWrongSubmitPenalty: 10,
        multiplierNoHint: 1.5,
    },
};

/**
 * Mirrors the Anagram score preview used by the current ClassHero frontend.
 *
 * Important: material-scoped 50% scaling is applied server-side. Therefore the
 * value returned here is sent to `xpPreview` without being halved.
 */
export function calculateAnagramXpPreview(
    mode: GameMode,
    wrongSubmitCount: number,
    hintsUsed: number,
    emergencyHintsUsed = 0,
): AnagramXpPreview {
    const rule = RULES[knownMode(mode)];

    const normalizedWrongSubmits = nonNegativeInteger(
        wrongSubmitCount,
    );
    const normalizedHints = nonNegativeInteger(
        hintsUsed,
    );
    const normalizedEmergencyHints = nonNegativeInteger(
        emergencyHintsUsed,
    );

    const hintPenalty =
        normalizedEmergencyHints *
        rule.emergencyHintPenalty;

    const extraErrorPenalty =
        rule.extraWrongSubmitPenaltyStart ===
        Number.POSITIVE_INFINITY
            ? 0
            : Math.max(
                0,
                normalizedWrongSubmits -
                    rule.extraWrongSubmitPenaltyStart,
            ) *
                rule.extraWrongSubmitPenalty;

    let xp =
        rule.baseXp -
        hintPenalty -
        extraErrorPenalty;

    let multiplier = 1;

    if (
        rule.multiplierNoHint !== undefined &&
        normalizedHints === 0
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

function knownMode(
    mode: GameMode,
): "estudo" | "foco" | "desafio" {
    if (mode === "estudo") {
        return "estudo";
    }

    if (mode === "foco") {
        return "foco";
    }

    return "desafio";
}

function nonNegativeInteger(
    value: number,
): number {
    return Number.isFinite(value)
        ? Math.max(
            0,
            Math.floor(value),
        )
        : 0;
}
