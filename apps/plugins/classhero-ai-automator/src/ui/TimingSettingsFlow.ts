import type { PluginContext } from "@classhero-cli/plugin-api";
import type {
    AutomatorTimingConfig,
    GameDifficultyTiming,
    TimedMiniGame,
} from "../timing/TimingConfig.js";
import type { TimingConfigStore } from "../timing/TimingConfigStore.js";

type SettingsAction =
    | "toggle"
    | "games"
    | "quiz"
    | "reset"
    | "back";

type GameAction =
    | "wordSearch"
    | "memory"
    | "hangman"
    | "anagram"
    | "back";

/**
 * Interactive configuration flow for the automator timing policy.
 *
 * Values are persisted in the plugin-scoped storage and take effect on the
 * next execution without restarting the CLI.
 */
export class TimingSettingsFlow {
    constructor(
        private readonly context: PluginContext,
        private readonly store: TimingConfigStore,
    ) {}

    /** Opens the timing configuration menu. */
    async run(): Promise<void> {
        while (true) {
            const config = await this.store.get();

            const selection = await this.context.prompts.run<SettingsAction>({
                id: "classhero-ai-automator.settings",
                kind: "select",
                message: "Configurações do Automator",
                options: [
                    {
                        id: "classhero-ai-automator.settings.toggle",
                        value: "toggle",
                        label: "Controle de tempo",
                        hint: config.enabled
                            ? "ativado"
                            : "desativado",
                    },
                    {
                        id: "classhero-ai-automator.settings.games",
                        value: "games",
                        label: "Tempos dos mini-games",
                        hint: "Estudo, Foco e Desafio",
                    },
                    {
                        id: "classhero-ai-automator.settings.quiz",
                        value: "quiz",
                        label: "Tempo por pergunta (quiz e trilha)",
                        hint: `${config.quiz.secondsPerQuestion}s por pergunta`,
                    },
                    {
                        id: "classhero-ai-automator.settings.reset",
                        value: "reset",
                        label: "Restaurar padrões",
                    },
                    {
                        id: "classhero-ai-automator.settings.back",
                        value: "back",
                        label: "Voltar",
                    },
                ],
            });

            if (
                selection.status !== "submitted" ||
                selection.value === "back"
            ) {
                return;
            }

            switch (selection.value) {
                case "toggle":
                    await this.toggleTiming(config);
                    break;

                case "games":
                    await this.configureGames();
                    break;

                case "quiz":
                    await this.configureQuiz(config);
                    break;

                case "reset":
                    await this.reset();
                    break;
            }
        }
    }

    private async toggleTiming(
        config: AutomatorTimingConfig,
    ): Promise<void> {
        const result = await this.context.prompts.run({
            id: "classhero-ai-automator.settings.enabled",
            kind: "confirm",
            message: config.enabled
                ? "Desativar o controle de tempo?"
                : "Ativar o controle de tempo?",
            initialValue: config.enabled,
            activeLabel: "Ativado",
            inactiveLabel: "Desativado",
        });

        if (result.status !== "submitted") {
            return;
        }

        const next = await this.store.setEnabled(result.value);
        this.context.logger.info(
            next.enabled
                ? "Controle de tempo ativado."
                : "Controle de tempo desativado.",
        );
    }

    private async configureGames(): Promise<void> {
        while (true) {
            const config = await this.store.get();

            const selection = await this.context.prompts.run<GameAction>({
                id: "classhero-ai-automator.settings.games",
                kind: "select",
                message: "Tempos mínimos dos mini-games",
                options: [
                    gameOption(
                        "wordSearch",
                        "Caça-palavras",
                        config.games.wordSearch,
                    ),
                    gameOption(
                        "memory",
                        "Jogo da memória",
                        config.games.memory,
                    ),
                    gameOption(
                        "hangman",
                        "Forca",
                        config.games.hangman,
                    ),
                    gameOption(
                        "anagram",
                        "Anagrama",
                        config.games.anagram,
                    ),
                    {
                        id: "classhero-ai-automator.settings.games.back",
                        value: "back",
                        label: "Voltar",
                    },
                ],
            });

            if (
                selection.status !== "submitted" ||
                selection.value === "back"
            ) {
                return;
            }

            await this.configureGame(
                selection.value,
                gameLabel(selection.value),
                config.games[selection.value],
            );
        }
    }

    private async configureGame(
        game: TimedMiniGame,
        label: string,
        current: GameDifficultyTiming,
    ): Promise<void> {
        const estudo = await this.askSeconds(
            `classhero-ai-automator.settings.${game}.estudo`,
            `${label} — Estudo (segundos)`,
            current.estudo,
            3600,
        );

        if (estudo === undefined) {
            return;
        }

        const foco = await this.askSeconds(
            `classhero-ai-automator.settings.${game}.foco`,
            `${label} — Foco (segundos)`,
            current.foco,
            3600,
        );

        if (foco === undefined) {
            return;
        }

        const desafio = await this.askSeconds(
            `classhero-ai-automator.settings.${game}.desafio`,
            `${label} — Desafio (segundos)`,
            current.desafio,
            3600,
        );

        if (desafio === undefined) {
            return;
        }

        await this.store.setGameTiming(game, {
            estudo,
            foco,
            desafio,
        });

        this.context.logger.info(
            `Tempos de '${label}' atualizados.`,
            {
                estudo,
                foco,
                desafio,
            },
        );
    }

    private async configureQuiz(
        config: AutomatorTimingConfig,
    ): Promise<void> {
        const seconds = await this.askSeconds(
            "classhero-ai-automator.settings.quiz.seconds-per-question",
            "Tempo mínimo por pergunta de quiz/trilha (segundos)",
            config.quiz.secondsPerQuestion,
            600,
        );

        if (seconds === undefined) {
            return;
        }

        await this.store.setQuizSecondsPerQuestion(seconds);

        this.context.logger.info(
            "Tempo por pergunta de quiz/trilha atualizado.",
            {
                secondsPerQuestion: seconds,
            },
        );
    }

    private async reset(): Promise<void> {
        const confirmation = await this.context.prompts.run({
            id: "classhero-ai-automator.settings.reset.confirm",
            kind: "confirm",
            message: "Restaurar todas as configurações de tempo para os padrões?",
            initialValue: false,
        });

        if (
            confirmation.status !== "submitted" ||
            !confirmation.value
        ) {
            return;
        }

        const config = await this.store.reset();

        this.context.logger.info(
            "Configurações de tempo restauradas.",
            {
                enabled: config.enabled,
                quizSecondsPerQuestion:
                    config.quiz.secondsPerQuestion,
            },
        );
    }

    private async askSeconds(
        id: string,
        message: string,
        current: number,
        maximum: number,
    ): Promise<number | undefined> {
        const result = await this.context.prompts.run({
            id,
            kind: "text",
            message,
            initialValue: String(current),
            placeholder: String(current),
            validate: (value) => validateSeconds(
                value,
                maximum,
            ),
        });

        if (result.status !== "submitted") {
            return undefined;
        }

        return Number.parseInt(result.value.trim(), 10);
    }
}

function gameOption(
    game: TimedMiniGame,
    label: string,
    timing: GameDifficultyTiming,
) {
    return {
        id: `classhero-ai-automator.settings.games.${game}`,
        value: game,
        label,
        hint: `Estudo ${timing.estudo}s · Foco ${timing.foco}s · Desafio ${timing.desafio}s`,
    } as const;
}

function gameLabel(game: TimedMiniGame): string {
    switch (game) {
        case "wordSearch":
            return "Caça-palavras";
        case "memory":
            return "Jogo da memória";
        case "hangman":
            return "Forca";
        case "anagram":
            return "Anagrama";
    }
}

function validateSeconds(
    value: string,
    maximum: number,
): string | undefined {
    const trimmed = value.trim();

    if (!/^\d+$/.test(trimmed)) {
        return "Digite um número inteiro de segundos.";
    }

    const seconds = Number.parseInt(trimmed, 10);

    if (seconds < 0 || seconds > maximum) {
        return `Use um valor entre 0 e ${maximum} segundos.`;
    }

    return undefined;
}
