import type {
    AvailableGame,
} from "@classhero-cli/api-wrapper";
import type {
    PluginContext,
} from "@classhero-cli/plugin-api";
import type {
    MissionAutomationContext,
    MissionBonusGameTargetId,
} from "../contracts/mission.js";
import type {
    AutomationEngine,
} from "../engine/AutomationEngine.js";
import {
    MissionBonusCompletionStore,
} from "./MissionBonusCompletionStore.js";

const SUPPORTED =
    new Set<
        MissionBonusGameTargetId
    >([
        "memory",
        "word-search",
        "hangman",
    ]);

const NATIVE =
    new Set<
        MissionBonusGameTargetId
    >([
        "memory",
        "word-search",
    ]);

export interface MissionBonusGameSelection {
    readonly selected:
        MissionBonusGameTargetId;
    readonly tier:
        | "native"
        | "ai";
    readonly availableSupported:
        readonly MissionBonusGameTargetId[];
    readonly ignoredGameIds:
        readonly string[];
}

/**
 * Chooses a mission bonus game while preserving tokens whenever possible.
 *
 * Native deterministic games are always the first tier. Hangman is considered
 * only when neither Memory nor Word Search is available.
 */
export function chooseMissionBonusGame(
    games: readonly AvailableGame[],
    random: () => number = Math.random,
): MissionBonusGameSelection | undefined {
    const supported = unique(
        games
            .map(
                (game) =>
                    String(
                        game.id,
                    ),
            )
            .filter(
                (
                    id,
                ): id is MissionBonusGameTargetId =>
                    SUPPORTED.has(
                        id as MissionBonusGameTargetId,
                    ),
            ),
    );

    const ignoredGameIds = unique(
        games
            .map(
                (game) =>
                    String(
                        game.id,
                    ),
            )
            .filter(
                (id) =>
                    !SUPPORTED.has(
                        id as MissionBonusGameTargetId,
                    ),
            ),
    );

    const native =
        supported.filter(
            (id) =>
                NATIVE.has(id),
        );

    const pool =
        native.length > 0
            ? native
            : supported.filter(
                (id) =>
                    id ===
                    "hangman",
            );

    if (pool.length === 0) {
        return undefined;
    }

    const sampled = random();
    const normalizedRandom =
        Number.isFinite(
            sampled,
        )
            ? Math.min(
                0.999999999999,
                Math.max(
                    0,
                    sampled,
                ),
            )
            : 0;

    const selected =
        pool[
            Math.floor(
                normalizedRandom *
                pool.length,
            )
        ] ??
        pool[0];

    if (!selected) {
        return undefined;
    }

    return {
        selected,
        tier:
            NATIVE.has(
                selected,
            )
                ? "native"
                : "ai",
        availableSupported:
            supported,
        ignoredGameIds,
    };
}

/** Interactive one-shot mission bonus launcher. */
export class MissionBonusGameFlow {
    private readonly completions:
        MissionBonusCompletionStore;

    constructor(
        private readonly context:
            PluginContext,
        private readonly engine:
            AutomationEngine,
        private readonly random:
            () => number =
                Math.random,
    ) {
        this.completions =
            new MissionBonusCompletionStore(
                context.storage,
            );
    }

    async run(
        mission:
            MissionAutomationContext,
    ): Promise<void> {
        /* Local successful completion is checked first and costs no request. */
        const local =
            await this.completions.get(
                mission.missionId,
            );

        if (local) {
            this.context.logger.warn(
                "O jogo bônus desta missão já foi concluído e só pode ser realizado uma vez.",
                {
                    source:
                        local.source,
                    completedAt:
                        local.completedAt,
                    ...(local.gameId ===
                    undefined
                        ? {}
                        : {
                            gameId:
                                local.gameId,
                        }),
                    ...(local.xpAwarded ===
                    undefined
                        ? {}
                        : {
                            xpAwarded:
                                local.xpAwarded,
                        }),
                },
            );
            return;
        }

        /*
         * The latest captured XP response exposes mission_bonus_xp and its sum
         * matches the response debug `game_bonus_total`. A positive value is
         * therefore an authoritative cross-device signal that this mission has
         * already earned its one-shot game bonus.
         */
        const serverCompletion =
            await this.serverCompletion(
                mission,
            );

        if (serverCompletion) {
            await this.completions.mark(
                mission.missionId,
                {
                    completedAt:
                        new Date()
                            .toISOString(),
                    source:
                        "xp-progress",
                    xpAwarded:
                        serverCompletion,
                },
            );

            this.context.logger.warn(
                "O jogo bônus desta missão já foi realizado no ClassHero e não pode ser iniciado novamente.",
                {
                    missionBonusXp:
                        serverCompletion,
                    source:
                        "xp-progress",
                },
            );
            return;
        }

        /*
         * `/games/available` remains a backend eligibility check. If ClassHero
         * stops advertising bonus candidates after consumption, the CLI
         * blocks naturally even on a fresh installation with no local cache.
         */
        const available =
            await this.context.api
                .games.available({
                    /* ClassHero names this query parameter materialId even
                     * when the value is the mission/theme id. */
                    materialId:
                        mission.missionId,
                    mode:
                        "desafio",
                });

        if (!available.ok) {
            this.context.logger.error(
                `Não foi possível verificar os jogos bônus disponíveis (HTTP ${available.status}). Nenhum jogo foi iniciado.`,
            );
            return;
        }

        const selection =
            chooseMissionBonusGame(
                available.response
                    .games,
                this.random,
            );

        if (!selection) {
            this.context.logger.warn(
                "O ClassHero não retornou nenhum jogo bônus disponível/suportado. A atividade não será iniciada.",
                {
                    returnedGames:
                        available.response
                            .games.map(
                                (game) =>
                                    game.id,
                            ),
                },
            );
            return;
        }

        this.context.logger.info(
            selection.tier ===
                "native"
                ? "Jogo bônus nativo priorizado para preservar tokens de IA."
                : "Nenhum jogo bônus nativo está disponível; a Forca é a opção compatível restante.",
            {
                selected:
                    selection.selected,
                priorityTier:
                    selection.tier,
                supportedAvailable:
                    selection.availableSupported,
                ignored:
                    selection.ignoredGameIds,
            },
        );

        if (
            selection.selected ===
            "hangman"
        ) {
            const provider =
                await this.engine
                    .availableAIProvider(
                        "hangman",
                    );

            if (!provider) {
                this.context.logger.warn(
                    "Apenas a Forca está disponível como jogo bônus, mas ela exige IA e nenhum provider compatível está configurado. Nenhum jogo foi iniciado.",
                );
                return;
            }
        }

        const confirmation =
            await this.context
                .prompts
                .run({
                    id:
                        "classhero-ai-automator.mission-bonus.confirm",
                    kind:
                        "confirm",
                    message:
                        `Jogo bônus selecionado: ${bonusGameLabel(selection.selected)}. Iniciar em modo Desafio?`,
                    initialValue:
                        true,
                });

        if (
            confirmation.status !==
                "submitted" ||
            !confirmation.value
        ) {
            return;
        }

        const result =
            await this.engine
                .executeMissionBonus(
                    mission,
                    selection.selected,
                );

        const metadata =
            result.details ??
            {};

        switch (result.status) {
            case "completed": {
                const xpAwarded =
                    numberValue(
                        metadata.xpAwarded,
                    );

                await this.completions.mark(
                    mission.missionId,
                    {
                        completedAt:
                            new Date()
                                .toISOString(),
                        gameId:
                            selection.selected,
                        source:
                            "local-completion",
                        ...(xpAwarded ===
                        undefined
                            ? {}
                            : {
                                xpAwarded,
                            }),
                    },
                );

                this.context.logger.info(
                    result.message,
                    {
                        ...metadata,
                        missionBonusLocked:
                            true,
                    },
                );
                break;
            }

            case "blocked":
            case "unsupported":
                this.context.logger.warn(
                    result.message,
                    metadata,
                );
                break;

            case "failed":
                this.context.logger.error(
                    result.message,
                    metadata,
                );
                break;
        }
    }

    private async serverCompletion(
        mission:
            MissionAutomationContext,
    ): Promise<number | undefined> {
        if (!mission.courseId) {
            return undefined;
        }

        const response =
            await this.context.api
                .xpProgress
                .missions(
                    mission.courseId,
                );

        if (!response.ok) {
            this.context.logger.warn(
                "Não foi possível consultar o XP de bônus da missão; o CLI continuará usando o cache local e /games/available como verificações de elegibilidade.",
                {
                    status:
                        response.status,
                },
            );
            return undefined;
        }

        const item =
            response.response
                .missions.find(
                    (candidate) =>
                        candidate.theme_id ===
                        mission.missionId,
                );

        if (!item) {
            return undefined;
        }

        return item.mission_bonus_xp >
            0
            ? item.mission_bonus_xp
            : undefined;
    }
}

function bonusGameLabel(
    id: MissionBonusGameTargetId,
): string {
    switch (id) {
        case "memory":
            return "Jogo da Memória";
        case "word-search":
            return "Caça-palavras";
        case "hangman":
            return "Forca";
    }
}

function numberValue(
    value: unknown,
): number | undefined {
    return typeof value ===
        "number" &&
        Number.isFinite(value)
        ? value
        : undefined;
}

function unique<T>(
    values: readonly T[],
): T[] {
    return [
        ...new Set(values),
    ];
}
