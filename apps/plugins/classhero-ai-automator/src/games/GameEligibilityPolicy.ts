import type {
    ClassHero,
    GameMode,
    JourneyAssociatedAction,
    JourneyAssociatedGameProgress,
    JourneyMapProgress,
} from "@classhero-cli/api-wrapper";
import {
    getActivityTarget,
    getSourceMissionMaterialId,
} from "../context/ActivityTargets.js";
import type {
    ActivityContext,
    AutomationTargetId,
} from "../contracts/activity.js";

export type RetryControlledGameId =
    | "word-search"
    | "memory"
    | "hangman"
    | "anagram";

export type StandardGameMode =
    | "estudo"
    | "foco"
    | "desafio";

export interface GameModeEligibility {
    readonly mode: StandardGameMode;
    readonly allowed: boolean;
    readonly reason: string;
    readonly completed?: boolean;
    readonly xpEarned?: number;
    readonly xpPossible?: number;
    readonly attemptId?: string;
    readonly source:
        | "study-unlimited"
        | "journey-progress"
        | "not-started"
        | "unverified";
}

interface ResolvedProgress {
    readonly action:
        JourneyAssociatedAction | undefined;
    readonly verified: boolean;
    readonly reason?: string;
}

/**
 * Enforces ClassHero's retry policy before a material-scoped mini-game starts.
 *
 * Study mode is intentionally unlimited. Focus/Challenge are locked only when
 * the exact game/mode progress entry is marked as `completed: true`. XP values
 * are retained only as diagnostic metadata and never decide retry eligibility.
 */
export class GameEligibilityPolicy {
    constructor(
        private readonly api:
            ClassHero,
    ) {}

    async inspect(
        activity: ActivityContext,
        gameId: RetryControlledGameId,
    ): Promise<readonly GameModeEligibility[]> {
        const resolved =
            await this.resolveProgress(
                activity,
            );

        return [
            studyEligibility(),
            this.nonStudyEligibility(
                "foco",
                gameId,
                resolved,
            ),
            this.nonStudyEligibility(
                "desafio",
                gameId,
                resolved,
            ),
        ];
    }

    async check(
        activity: ActivityContext,
        gameId: RetryControlledGameId,
        mode: GameMode,
    ): Promise<GameModeEligibility> {
        if (mode === "estudo") {
            return studyEligibility();
        }

        if (!isRestrictedMode(mode)) {
            return {
                mode:
                    "desafio",
                allowed:
                    false,
                reason:
                    `O modo '${mode}' não faz parte da política conhecida de Estudo/Foco/Desafio.`,
                source:
                    "unverified",
            };
        }

        const resolved =
            await this.resolveProgress(
                activity,
            );

        return this.nonStudyEligibility(
            mode,
            gameId,
            resolved,
        );
    }

    private nonStudyEligibility(
        mode: "foco" | "desafio",
        gameId: RetryControlledGameId,
        resolved: ResolvedProgress,
    ): GameModeEligibility {
        if (!resolved.verified) {
            return {
                mode,
                allowed:
                    false,
                reason:
                    resolved.reason ??
                    "Não foi possível verificar o progresso deste jogo; o modo foi bloqueado preventivamente.",
                source:
                    "unverified",
            };
        }

        const progress =
            resolved.action
                ?.game_progress
                ?.find(
                    (entry) =>
                        sameGame(
                            entry.game_key,
                            gameId,
                        ) &&
                        entry.mode ===
                            mode,
                );

        if (!progress) {
            return {
                mode,
                allowed:
                    true,
                reason:
                    "Nenhuma tentativa pontuada encontrada para este jogo/modo.",
                source:
                    "not-started",
            };
        }

        return eligibilityFromProgress(
            mode,
            progress,
        );
    }

    /**
     * Resolves the exact associated `games` action for the selected logical
     * activity. A source mission-material id is used whenever available so two
     * PDFs sharing the same games ThemeMaterial never contaminate each other's
     * retry state.
     */
    private async resolveProgress(
        activity: ActivityContext,
    ): Promise<ResolvedProgress> {
        const gamesTarget =
            getActivityTarget(
                activity,
                "games",
            );

        if (!gamesTarget) {
            return {
                verified:
                    false,
                action:
                    undefined,
                reason:
                    "A atividade não possui um target de jogos.",
            };
        }

        const [
            journeyResponse,
            progressResponse,
        ] = await Promise.all([
            this.api.journeyMap.student(
                activity.themeId,
            ),
            this.api.journeyMap.studentProgress(
                activity.themeId,
            ),
        ]);

        if (
            !journeyResponse.ok ||
            !progressResponse.ok
        ) {
            return {
                verified:
                    false,
                action:
                    undefined,
                reason:
                    `Não foi possível consultar o progresso da jornada (journey HTTP ${journeyResponse.status}; progress HTTP ${progressResponse.status}).`,
            };
        }

        const journey =
            journeyResponse.response.data;
        const progress =
            progressResponse.response.data;
        const sourceId =
            getSourceMissionMaterialId(
                activity,
            );

        if (sourceId) {
            const node =
                journey.nodes.find(
                    (candidate) =>
                        candidate.target_scope ===
                            "mission_material" &&
                        candidate.target_id ===
                            sourceId,
                );

            if (!node) {
                return {
                    verified:
                        false,
                    action:
                        undefined,
                    reason:
                        "O material-fonte da atividade não foi encontrado na Journey Map atual.",
                };
            }

            const state =
                progressState(
                    progress,
                    node.node_key,
                );

            if (!state) {
                /* The Journey response itself was verified. Missing progress
                 * means the action has not produced progress yet. */
                return {
                    verified:
                        true,
                    action:
                        undefined,
                };
            }

            const action =
                associatedGamesAction(
                    state,
                    gamesTarget
                        .materialId,
                );

            return {
                verified:
                    true,
                action,
            };
        }

        /* Direct games ThemeMaterial nodes can be unambiguous. */
        const directNode =
            journey.nodes.find(
                (candidate) =>
                    candidate.target_scope ===
                        "theme_material" &&
                    candidate.target_id ===
                        gamesTarget.materialId,
            );

        if (directNode) {
            const state =
                progressState(
                    progress,
                    directNode.node_key,
                );

            return {
                verified:
                    true,
                action:
                    state
                        ? associatedGamesAction(
                            state,
                            gamesTarget.materialId,
                        ) ??
                            directGamesAction(
                                state,
                            )
                        : undefined,
            };
        }

        /* Legacy fallback: accept only one matching action. */
        const matches =
            allProgressStates(
                progress,
            )
                .map(
                    (state) =>
                        associatedGamesAction(
                            state,
                            gamesTarget
                                .materialId,
                        ),
                )
                .filter(
                    (
                        action,
                    ): action is JourneyAssociatedAction =>
                        action !==
                        undefined,
                );

        if (matches.length > 1) {
            return {
                verified:
                    false,
                action:
                    undefined,
                reason:
                    "O mesmo material de jogos aparece em mais de uma atividade e não há material-fonte suficiente para determinar qual progresso deve ser usado.",
            };
        }

        return {
            verified:
                true,
            action:
                matches[0],
        };
    }
}

export function isRetryControlledGame(
    targetId: AutomationTargetId,
): targetId is RetryControlledGameId {
    return (
        targetId ===
            "word-search" ||
        targetId ===
            "memory" ||
        targetId ===
            "hangman" ||
        targetId ===
            "anagram"
    );
}

function studyEligibility(): GameModeEligibility {
    return {
        mode:
            "estudo",
        allowed:
            true,
        reason:
            "Modo Estudo é prática livre e pode ser repetido.",
        source:
            "study-unlimited",
    };
}

function eligibilityFromProgress(
    mode: "foco" | "desafio",
    progress: JourneyAssociatedGameProgress,
): GameModeEligibility {
    const xpEarned =
        finiteNonNegative(
            progress.xp_earned,
        );
    const xpPossible =
        finiteNonNegative(
            progress.xp_possible,
        );
    const completed =
        progress.completed ===
        true;

    return {
        mode,
        allowed:
            !completed,
        reason:
            completed
                ? "Modo bloqueado: este jogo/modo já está marcado como concluído."
                : "Modo disponível: este jogo/modo ainda não está marcado como concluído.",
        completed,
        xpEarned,
        xpPossible,
        source:
            "journey-progress",
        ...(progress.attempt_id ===
        undefined
            ? {}
            : {
                attemptId:
                    progress.attempt_id,
            }),
    };
}

function associatedGamesAction(
    state: Readonly<Record<string, unknown>>,
    materialId: string,
): JourneyAssociatedAction | undefined {
    const actions =
        state.associated_actions;

    if (!Array.isArray(actions)) {
        return undefined;
    }

    return actions.find(
        (
            value,
        ): value is JourneyAssociatedAction =>
            isGamesAction(
                value,
                materialId,
            ),
    );
}

/** Supports a future/direct progress shape if game_progress is on the state. */
function directGamesAction(
    state: Readonly<Record<string, unknown>>,
): JourneyAssociatedAction | undefined {
    if (
        !Array.isArray(
            state.game_progress,
        )
    ) {
        return undefined;
    }

    return {
        target_type:
            "games",
        target_id:
            "",
        is_required:
            true,
        started:
            true,
        completed:
            state.completed ===
            true,
        xp_earned:
            numberOrZero(
                state.xp_earned,
            ),
        xp_possible:
            numberOrZero(
                state.xp_possible,
            ),
        game_progress:
            state.game_progress.filter(
                isGameProgress,
            ),
    };
}

function isGamesAction(
    value: unknown,
    materialId: string,
): value is JourneyAssociatedAction {
    if (!isRecord(value)) {
        return false;
    }

    return (
        value.target_type ===
            "games" &&
        value.target_id ===
            materialId
    );
}

function isGameProgress(
    value: unknown,
): value is JourneyAssociatedGameProgress {
    if (!isRecord(value)) {
        return false;
    }

    return (
        typeof value.game_key ===
            "string" &&
        typeof value.mode ===
            "string" &&
        typeof value.xp_earned ===
            "number" &&
        typeof value.xp_possible ===
            "number" &&
        typeof value.completed ===
            "boolean"
    );
}

function progressState(
    progress: JourneyMapProgress,
    nodeKey: string,
): Readonly<Record<string, unknown>> | undefined {
    const value =
        progress[nodeKey];

    return isRecord(value)
        ? value
        : undefined;
}

function allProgressStates(
    progress: JourneyMapProgress,
): Readonly<Record<string, unknown>>[] {
    return Object.values(
        progress,
    ).filter(
        (
            value,
        ): value is Readonly<
            Record<string, unknown>
        > => isRecord(value),
    );
}

function isRestrictedMode(
    mode: GameMode,
): mode is "foco" | "desafio" {
    return (
        mode === "foco" ||
        mode === "desafio"
    );
}

function sameGame(
    progressKey: string,
    targetId: RetryControlledGameId,
): boolean {
    return normalizeGameKey(
        progressKey,
    ) ===
        normalizeGameKey(
            targetId,
        );
}

function normalizeGameKey(
    value: string,
): string {
    return value
        .trim()
        .toLowerCase()
        .replaceAll(
            "-",
            "_",
        );
}

function finiteNonNegative(
    value: number,
): number {
    return Number.isFinite(value)
        ? Math.max(
            0,
            value,
        )
        : 0;
}

function numberOrZero(
    value: unknown,
): number {
    return typeof value ===
        "number" &&
        Number.isFinite(value)
        ? Math.max(
            0,
            value,
        )
        : 0;
}

function isRecord(
    value: unknown,
): value is Record<string, unknown> {
    return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
    );
}
