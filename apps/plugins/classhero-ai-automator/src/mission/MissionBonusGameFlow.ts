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

const SUPPORTED = new Set<MissionBonusGameTargetId>([
    "memory",
    "word-search",
    "hangman",
]);

const NATIVE = new Set<MissionBonusGameTargetId>([
    "memory",
    "word-search",
]);

export interface MissionBonusGameSelection {
    readonly selected: MissionBonusGameTargetId;
    readonly tier: "native" | "ai";
    readonly availableSupported: readonly MissionBonusGameTargetId[];
    readonly ignoredGameIds: readonly string[];
}

/**
 * Chooses a mission bonus game while preserving tokens whenever possible.
 *
 * ClassHero's web launcher randomly selects among supported bonus games. The
 * CLI keeps the random choice inside a priority tier, but uses deterministic
 * native solvers first:
 *
 * 1. memory / word-search (random between whichever are available)
 * 2. hangman only when no native game is available
 *
 * Quiz is intentionally ignored here even if `/games/available` returns it;
 * the current ClassHero bonus-game launcher also filters its bonus candidates
 * to memory, word-search and hangman.
 */
export function chooseMissionBonusGame(
    games: readonly AvailableGame[],
    random: () => number = Math.random,
): MissionBonusGameSelection | undefined {
    const supported = unique(
        games
            .map((game) => String(game.id))
            .filter(
                (id): id is MissionBonusGameTargetId =>
                    SUPPORTED.has(id as MissionBonusGameTargetId),
            ),
    );

    const ignoredGameIds = unique(
        games
            .map((game) => String(game.id))
            .filter(
                (id) => !SUPPORTED.has(id as MissionBonusGameTargetId),
            ),
    );

    const native = supported.filter((id) => NATIVE.has(id));
    const pool = native.length > 0
        ? native
        : supported.filter((id) => id === "hangman");

    if (pool.length === 0) {
        return undefined;
    }

    const sampled = random();
    const normalizedRandom = Number.isFinite(sampled)
        ? Math.min(0.999999999999, Math.max(0, sampled))
        : 0;
    const selected = pool[Math.floor(normalizedRandom * pool.length)] ?? pool[0];

    if (!selected) {
        return undefined;
    }

    return {
        selected,
        tier: NATIVE.has(selected) ? "native" : "ai",
        availableSupported: supported,
        ignoredGameIds,
    };
}

/** Interactive mission-level bonus game launcher. */
export class MissionBonusGameFlow {
    constructor(
        private readonly context: PluginContext,
        private readonly engine: AutomationEngine,
        private readonly random: () => number = Math.random,
    ) {}

    async run(
        mission: MissionAutomationContext,
    ): Promise<void> {
        const available = await this.context.api.games.available({
            /* ClassHero names this query parameter materialId even when the
             * value is the mission/theme id in the bonus launcher. */
            materialId: mission.missionId,
            mode: "desafio",
        });

        if (!available.ok) {
            this.context.logger.error(
                `Não foi possível consultar os jogos bônus disponíveis (HTTP ${available.status}).`,
            );
            return;
        }

        const selection = chooseMissionBonusGame(
            available.response.games,
            this.random,
        );

        if (!selection) {
            this.context.logger.warn(
                "O ClassHero não retornou nenhum jogo bônus atualmente suportado pelo Automator.",
                {
                    returnedGames: available.response.games.map((game) => game.id),
                },
            );
            return;
        }

        this.context.logger.info(
            selection.tier === "native"
                ? "Jogo bônus nativo priorizado para preservar tokens de IA."
                : "Nenhum jogo bônus nativo está disponível; a Forca é a opção compatível restante.",
            {
                selected: selection.selected,
                priorityTier: selection.tier,
                supportedAvailable: selection.availableSupported,
                ignored: selection.ignoredGameIds,
            },
        );

        if (selection.selected === "hangman") {
            const provider = await this.engine.availableAIProvider("hangman");

            if (!provider) {
                this.context.logger.warn(
                    "Apenas a Forca está disponível como jogo bônus, mas ela exige IA e nenhum provider compatível está configurado. Nenhum jogo foi iniciado.",
                );
                return;
            }
        }

        const confirmation = await this.context.prompts.run({
            id: "classhero-ai-automator.mission-bonus.confirm",
            kind: "confirm",
            message:
                `Jogo bônus selecionado: ${bonusGameLabel(selection.selected)}. Iniciar em modo Desafio?`,
            initialValue: true,
        });

        if (
            confirmation.status !== "submitted" ||
            !confirmation.value
        ) {
            return;
        }

        const result = await this.engine.executeMissionBonus(
            mission,
            selection.selected,
        );

        const metadata = result.details ?? {};

        switch (result.status) {
            case "completed":
                this.context.logger.info(result.message, metadata);
                break;
            case "blocked":
            case "unsupported":
                this.context.logger.warn(result.message, metadata);
                break;
            case "failed":
                this.context.logger.error(result.message, metadata);
                break;
        }
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

function unique<T>(
    values: readonly T[],
): T[] {
    return [...new Set(values)];
}
