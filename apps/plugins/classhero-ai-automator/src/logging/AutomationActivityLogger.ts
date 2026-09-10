import type {
    GameMode,
    HangmanGuessResponse,
    HangmanPuzzle,
    HangmanSubmitResponse,
    MemoryGameResponse,
    QuizAttemptQuestionValidateResponse,
    QuizLevel,
    QuizQuestion,
    QuizScoreResponse,
    WordSearchFoundWord,
    WordSearchGameResponse,
    WordSearchKeyword,
} from "@classhero-cli/api-wrapper";
import type { PluginLogger } from "@classhero-cli/plugin-api";
import type {
    MemoryPair,
    UnresolvedMemoryPair,
} from "../solvers/MemorySolver.js";
import type {
    UnresolvedWordSearchWord,
} from "../solvers/WordSearchSolver.js";
import type {
    HangmanGuessEvidence,
    HangmanKnowledge,
} from "../executors/HangmanKnowledge.js";
import type {
    TimingWaitResult,
} from "../timing/ExecutionTimingPolicy.js";

/**
 * Human-readable progress logger shared by native and AI-based activity
 * executors.
 *
 * Solvers remain pure. This class translates their results into useful CLI
 * output without coupling deterministic algorithms to a logging backend.
 */
export class AutomationActivityLogger {
    constructor(private readonly logger: PluginLogger) {}

    /**
     * Logs every clue/keyword before the word-search solver starts.
     *
     * `hint` is treated as the question/clue associated with the expected
     * keyword because that is the relation returned by the ClassHero game
     * payload.
     */
    wordSearchStarted(
        game: WordSearchGameResponse,
        mode: GameMode,
    ): void {
        const lines = game.key_words.map(
            (keyword, index) =>
                `- ${index + 1}. ${formatWordSearchQuestion(keyword)} → ${keyword.original}`,
        );

        this.logger.info(
            [
                `Iniciando caça-palavras (${mode}) com perguntas e palavras:`,
                "",
                ...lines,
            ].join("\n"),
            {
                gameId: game.game_id,
                totalWords: game.key_words.length,
                boardSize: game.array_size,
                mode,
            },
        );
    }

    /** Logs the coordinates of one successfully located word. */
    wordSearchFound(
        keyword: WordSearchKeyword,
        foundWord: WordSearchFoundWord,
    ): void {
        const start = foundWord.path[0];
        const end = foundWord.path.at(-1);

        if (!start || !end) {
            this.logger.warn(
                `A palavra '${keyword.original}' foi marcada como encontrada, mas o caminho retornado está vazio.`,
                {
                    word: keyword.original,
                    wordIndex: foundWord.wordIndex,
                },
            );
            return;
        }

        this.logger.info(
            `Palavra '${keyword.original}' encontrada: linha ${start.row + 1}, coluna ${start.col + 1} até linha ${end.row + 1}, coluna ${end.col + 1}.`,
            {
                word: keyword.original,
                wordIndex: foundWord.wordIndex,
                start: {
                    row: start.row,
                    col: start.col,
                },
                end: {
                    row: end.row,
                    col: end.col,
                },
            },
        );
    }

    /** Logs a keyword that could not be located in the received board. */
    wordSearchUnresolved(
        unresolved: UnresolvedWordSearchWord,
    ): void {
        this.logger.warn(
            `Palavra '${unresolved.word}' não encontrada na matriz do caça-palavras.`,
            {
                word: unresolved.word,
                wordIndex: unresolved.wordIndex,
            },
        );
    }

    /** Logs every exact word/definition relation returned for a memory game. */
    memoryStarted(
        game: MemoryGameResponse,
        mode: GameMode,
    ): void {
        const lines = game.glossary.map(
            (entry, index) =>
                `- ${index + 1}. ${entry.word} → ${entry.definition}`,
        );

        this.logger.info(
            [
                `Iniciando jogo da memória (${mode}) com palavras e definições:`,
                "",
                ...lines,
            ].join("\n"),
            {
                sessionId: game.session_id,
                totalPairs: game.glossary.length,
                totalCards: game.cards.length,
                mode,
            },
        );
    }

    /** Logs one word/definition relation successfully mapped to card ids. */
    memoryPairFound(
        pair: MemoryPair,
        index: number,
        total: number,
    ): void {
        this.logger.info(
            `Par ${index}/${total} encontrado: '${pair.word}' ↔ '${pair.definition}'.`,
            {
                word: pair.word,
                definition: pair.definition,
                wordCardId: pair.wordCardId,
                definitionCardId: pair.definitionCardId,
            },
        );
    }

    /** Logs a glossary relation that could not be mapped to both cards. */
    memoryPairUnresolved(
        pair: UnresolvedMemoryPair,
    ): void {
        this.logger.warn(
            `Não foi possível localizar as duas cartas do par '${pair.word}' ↔ '${pair.definition}'.`,
            {
                word: pair.word,
                definition: pair.definition,
            },
        );
    }

    /** Logs backend confirmation for a deterministic memory pair. */
    memoryPairValidated(
        pair: MemoryPair,
        index: number,
        total: number,
    ): void {
        this.logger.info(
            `Par ${index}/${total} validado pelo ClassHero: '${pair.word}' ↔ '${pair.definition}'.`,
            {
                word: pair.word,
                definition: pair.definition,
            },
        );
    }

    /**
     * Logs the puzzle context when the future hangman executor starts.
     *
     * This method is already available so the AI-backed hangman executor can
     * use the same logging surface without changing the public contract.
     */
    hangmanStarted(
        puzzle: HangmanPuzzle,
        mode: GameMode,
    ): void {
        this.logger.info(
            [
                `Iniciando forca (${mode}):`,
                "",
                `- Dica/pergunta: ${puzzle.hint}`,
                `- Máscara inicial: ${puzzle.mask}`,
                `- Quantidade de letras: ${puzzle.word_length}`,
            ].join("\n"),
            {
                puzzleId: puzzle.puzzle_id,
                materialId: puzzle.source.material_id,
                mode,
            },
        );
    }

    /** Logs the word proposed by an AI provider for a hangman puzzle. */
    hangmanAiAnswer(
        answer: string,
        providerName: string,
    ): void {
        this.logger.info(
            `Resposta gerada pela IA para a forca: ${answer}`,
            {
                provider: providerName,
                answer,
            },
        );
    }

    /** Logs an AI candidate rejected locally before any letter is sent. */
    hangmanCandidateRejected(
        answer: string,
        reason: string,
    ): void {
        this.logger.warn(
            `Candidato '${answer}' rejeitado antes dos palpites: ${reason}.`,
            {
                answer,
                reason,
            },
        );
    }

    /** Logs the exact evidence sent to the AI before a new reasoning round. */
    hangmanReasoningState(
        round: number,
        knowledge: HangmanKnowledge,
        providerName: string,
    ): void {
        this.logger.info(
            [
                `Análise da forca — rodada ${round}:`,
                `- Máscara atual: ${knowledge.mask}`,
                `- Letras confirmadas: ${formatList(knowledge.correctLetters)}`,
                `- Letras erradas: ${formatList(knowledge.wrongLetters)}`,
                `- wrongCount: ${knowledge.wrongCount}`,
                `- Tentativas restantes: ${knowledge.attemptsLeft}`,
                `- Candidatas rejeitadas: ${formatList(knowledge.rejectedCandidates)}`,
            ].join("\n"),
            {
                provider: providerName,
                round,
                mask: knowledge.mask,
                correctLetters: [...knowledge.correctLetters],
                wrongLetters: [...knowledge.wrongLetters],
                guessedLetters: [...knowledge.guessedLetters],
                wrongCount: knowledge.wrongCount,
                attemptsLeft: knowledge.attemptsLeft,
                rejectedCandidates: [...knowledge.rejectedCandidates],
            },
        );
    }

    /**
     * Logs one backend-evaluated letter.
     *
     * `wrongCount` is used to distinguish a wrong guess from a useful reveal.
     */
    hangmanGuess(
        evidence: HangmanGuessEvidence,
        result: HangmanGuessResponse,
    ): void {
        const status =
            evidence.outcome === "wrong"
                ? "ERRADA"
                : evidence.outcome === "correct"
                    ? "CORRETA"
                    : "sem nova revelação";

        this.logger.info(
            [
                `Letra '${evidence.letter}' enviada: ${status}.`,
                `- Máscara: '${evidence.maskBefore}' → '${evidence.maskAfter}'`,
                `- wrongCount: ${evidence.wrongCountBefore} → ${evidence.wrongCountAfter}`,
                `- Tentativas restantes: ${evidence.attemptsLeftAfter}`,
            ].join("\n"),
            {
                letter: evidence.letter,
                outcome: evidence.outcome,
                puzzleId: result.puzzle_id,
                maskBefore: evidence.maskBefore,
                maskAfter: evidence.maskAfter,
                wrongCountBefore: evidence.wrongCountBefore,
                wrongCountAfter: evidence.wrongCountAfter,
                attemptsLeft: evidence.attemptsLeftAfter,
                guessed: result.guessed,
                won: result.won,
                lost: result.lost,
            },
        );
    }

    /** Logs why the current word hypothesis is abandoned immediately. */
    hangmanRetryAfterWrongGuess(
        candidate: string,
        evidence: HangmanGuessEvidence,
        knowledge: HangmanKnowledge,
    ): void {
        this.logger.warn(
            [
                `A candidata '${candidate}' foi descartada porque a letra '${evidence.letter}' aumentou wrongCount.`,
                `Nova máscara: ${knowledge.mask}`,
                `Letras erradas confirmadas: ${formatList(knowledge.wrongLetters)}`,
                "Consultando a IA novamente com as novas evidências.",
            ].join("\n"),
            {
                candidate,
                wrongLetter: evidence.letter,
                wrongCount: knowledge.wrongCount,
                mask: knowledge.mask,
                correctLetters: [...knowledge.correctLetters],
                wrongLetters: [...knowledge.wrongLetters],
            },
        );
    }

    /** Logs a fully-tested hypothesis that still did not prove the word. */
    hangmanCandidateExhausted(
        candidate: string,
        knowledge: HangmanKnowledge,
    ): void {
        this.logger.warn(
            [
                `A candidata '${candidate}' não concluiu a forca.`,
                `Máscara após os palpites: ${knowledge.mask}`,
                "A IA será consultada novamente sem assumir que a palavra estava correta.",
            ].join("\n"),
            {
                candidate,
                mask: knowledge.mask,
                wrongCount: knowledge.wrongCount,
                correctLetters: [...knowledge.correctLetters],
                wrongLetters: [...knowledge.wrongLetters],
            },
        );
    }

    /** Logs the final backend result for a hangman round. */
    hangmanFinished(
        result: HangmanSubmitResponse,
        providerName: string,
    ): void {
        this.logger.info(
            [
                "Forca finalizada:",
                `- Palavra: ${result.revealed_word}`,
                `- Resultado: ${result.won ? "acertou" : "não acertou"}`,
                `- Score: ${result.score}`,
                `- XP: ${result.xp_awarded}`,
            ].join("\n"),
            {
                provider: providerName,
                attemptId: result.attempt_id,
                won: result.won,
                revealedWord: result.revealed_word,
                score: result.score,
                xpAwarded: result.xp_awarded,
            },
        );
    }

    /** Logs metadata for a resumed or newly-created quiz attempt. */
    quizStarted(
        attemptId: string,
        level: QuizLevel,
        total: number,
        providerName: string,
        resumed: boolean,
    ): void {
        this.logger.info(
            [
                resumed
                    ? "Continuando tentativa de quiz existente."
                    : "Iniciando nova tentativa de quiz.",
                `- Nível: ${level}`,
                `- Perguntas pendentes: ${total}`,
                `- Provider: ${providerName}`,
            ].join("\n"),
            {
                attemptId,
                level,
                total,
                provider: providerName,
                resumed,
            },
        );
    }

    /**
     * Logs one quiz question immediately before it is delegated to an AI
     * provider.
     */
    quizQuestion(
        question: QuizQuestion,
        index: number,
        total: number,
    ): void {
        const options = question.options.length > 0
            ? [
                "",
                "Alternativas:",
                ...question.options.map(
                    (option, optionIndex) =>
                        `- ${optionIndex + 1}. ${option.label}: ${option.text}`,
                ),
            ]
            : [];

        this.logger.info(
            [
                `Pergunta ${index}/${total}:`,
                question.question,
                ...options,
            ].join("\n"),
            {
                questionId: question.question_id,
                questionType: question.type,
                level: question.level,
                index,
                total,
            },
        );
    }

    /**
     * Logs the answer produced by an AI provider before the quiz executor
     * submits it to ClassHero.
     */
    quizAiAnswer(
        question: QuizQuestion,
        answer: unknown,
        providerName: string,
        index: number,
        total: number,
    ): void {
        this.logger.info(
            [
                `Resposta gerada pela IA para a pergunta ${index}/${total}:`,
                formatUnknown(answer),
            ].join("\n"),
            {
                questionId: question.question_id,
                provider: providerName,
                index,
                total,
            },
        );
    }

    /** Logs the exact answer immediately before a future quiz API submission. */
    quizAnswerSubmitting(
        question: QuizQuestion,
        answer: readonly string[],
        index: number,
        total: number,
    ): void {
        this.logger.info(
            [
                `Enviando resposta da pergunta ${index}/${total}:`,
                answer.length > 0
                    ? answer.map((item) => `- ${item}`).join("\n")
                    : "(resposta vazia)",
            ].join("\n"),
            {
                questionId: question.question_id,
                answer: [...answer],
                index,
                total,
            },
        );
    }


    /** Logs an AI answer rejected by the local type-specific guard. */
    quizAnswerRejected(
        question: QuizQuestion,
        reason: string,
        index: number,
        total: number,
    ): void {
        this.logger.warn(
            `Resposta da IA rejeitada na pergunta ${index}/${total}: ${reason}.`,
            {
                questionId: question.question_id,
                questionType: question.type,
                reason,
                index,
                total,
            },
        );
    }

    /** Logs the backend validation result after one quiz submission. */
    quizAnswerValidated(
        question: QuizQuestion,
        validation: QuizAttemptQuestionValidateResponse,
        index: number,
        total: number,
        timing: TimingWaitResult,
    ): void {
        const evaluation =
            validation.evaluation;

        const score =
            evaluation?.score ??
            validation.score;

        const correctness =
            validation.isCorrect ??
            (
                evaluation?.pedagogical_status ===
                    "correct"
                    ? true
                    : evaluation?.pedagogical_status ===
                        "incorrect"
                        ? false
                        : undefined
            );

        const xp =
            validation.questionXp ??
            validation.question_xp;

        this.logger.info(
            [
                `Resposta da pergunta ${index}/${total} validada pelo ClassHero.`,
                `- Tipo: ${question.type}`,
                `- Correta: ${correctness === undefined ? "avaliação sem booleano explícito" : correctness ? "sim" : "não"}`,
                `- Score: ${score ?? "não informado"}`,
                `- XP: ${xp ?? "não informado"}`,
                `- Status da avaliação: ${validation.evaluationStatus}`,
                `- Falha técnica: ${validation.technicalFailure ? "sim" : "não"}`,
                `- Tempo: ${timing.totalElapsedSeconds}s`,
            ].join("\n"),
            {
                questionId:
                    question.question_id,
                questionType:
                    question.type,
                isCorrect:
                    correctness,
                score,
                questionXp:
                    xp,
                evaluationStatus:
                    validation.evaluationStatus,
                technicalFailure:
                    validation.technicalFailure,
                timingSeconds:
                    timing.totalElapsedSeconds,
                index,
                total,
            },
        );
    }

    /** Logs the final score object returned after all quiz questions. */
    quizFinished(
        attemptId: string,
        score: QuizScoreResponse,
        answered: number,
        providerName: string,
    ): void {
        this.logger.info(
            [
                "Quiz finalizado:",
                `- Perguntas processadas: ${answered}`,
                `- Score: ${score.score ?? "não informado"}`,
                `- Score final: ${score.final_score ?? "não informado"}`,
            ].join("\n"),
            {
                attemptId,
                provider: providerName,
                answered,
                score: score.score,
                finalScore: score.final_score,
                scoreCorrect: score.score_correct,
                scoreAverageTime: score.score_avg_time,
                scoreTotalTime: score.score_total_time,
            },
        );
    }
}

function formatList(
    values: readonly string[],
): string {
    return values.length > 0
        ? values.join(", ")
        : "(nenhuma)";
}

function formatWordSearchQuestion(
    keyword: WordSearchKeyword,
): string {
    const hint = keyword.hint?.trim();
    return hint && hint.length > 0
        ? hint
        : "(sem pergunta/dica)";
}

function formatUnknown(value: unknown): string {
    if (typeof value === "string") {
        return value;
    }

    try {
        const serialized = JSON.stringify(
            value,
            null,
            2,
        );

        return serialized ?? String(value);
    } catch {
        return String(value);
    }
}
