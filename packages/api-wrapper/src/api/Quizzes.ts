import { Api, createQuery } from "../client/Api.js";
import type {
    ActiveQuizAttemptQuery,
    ActiveQuizAttemptResponse,
    CreateQuizContestInput,
    CreateQuizContestResponse,
    LatestFinishedQuizAttemptQuery,
    LatestFinishedQuizAttemptResponse,
    QuizAnswerRevealResponse,
    QuizAttemptQuestionUpdateInput,
    QuizAttemptQuestionUpdateResponse,
    QuizAttemptQuestionValidateInput,
    QuizAttemptQuestionValidateResponse,
    QuizContestsMineQuery,
    QuizContestsMineResponse,
    QuizHintRevealResponse,
    QuizPreviewValidationInput,
    QuizPreviewValidationResponse,
    QuizQuestion,
    QuizQuestionJsonResponse,
    QuizReopenResponse,
    QuizScoreResponse,
    QuizViolationInput,
    QuizViolationResponse,
    StartQuizAttemptInput,
    StartQuizAttemptResponse,
    UpdateQuizAttemptInput,
    UpdateQuizAttemptResponse,
} from "../types/index.js";

function traceHeaders(traceId: string): HeadersInit {
    return { "x-quiz-trace-id": traceId };
}

/** Quiz attempts, questions, validation, hints and review operations. */
export class Quizzes extends Api {
    question(questionId: string) {
        return this.request<QuizQuestion>(`/quizzes/${encodeURIComponent(questionId)}`);
    }

    activeAttempt(materialId: string, query: ActiveQuizAttemptQuery = {}) {
        return this.request<ActiveQuizAttemptResponse>(
            `/quizzes/attempt/${encodeURIComponent(materialId)}/active-attempt${createQuery({
                level: query.level,
                all_available: query.all_available,
                quantity: query.quantity,
                theme_mission_material_id: query.theme_mission_material_id,
            })}`,
        );
    }

    latestFinishedAttempt(materialId: string, query: LatestFinishedQuizAttemptQuery = {}) {
        return this.request<LatestFinishedQuizAttemptResponse>(
            `/quizzes/attempt/${encodeURIComponent(materialId)}/latest-finished-attempt${createQuery({
                theme_mission_material_id: query.theme_mission_material_id,
            })}`,
        );
    }

    startAttempt(input: StartQuizAttemptInput) {
        return this.request<StartQuizAttemptResponse>("/quizzes/attempt", {
            method: "POST",
            body: JSON.stringify(input),
        });
    }

    updateAttempt(attemptId: string, input: UpdateQuizAttemptInput) {
        return this.request<UpdateQuizAttemptResponse>(`/quizzes/attempts/${encodeURIComponent(attemptId)}`, {
            method: "PATCH",
            body: JSON.stringify(input),
        });
    }

    questionJson(attemptId: string, questionId: string) {
        return this.request<QuizQuestionJsonResponse>(
            `/quizzes/attempts/${encodeURIComponent(attemptId)}/questions/${encodeURIComponent(questionId)}/json`,
        );
    }

    updateAttemptQuestion(input: QuizAttemptQuestionUpdateInput, traceId?: string) {
        return this.request<QuizAttemptQuestionUpdateResponse | undefined>("/quizzes/quiz-attempt-questions/update", {
            method: "PATCH",
            ...(traceId ? { headers: traceHeaders(traceId) } : {}),
            body: JSON.stringify(input),
        });
    }

    validateAttemptQuestion(input: QuizAttemptQuestionValidateInput, traceId?: string) {
        return this.request<QuizAttemptQuestionValidateResponse>("/quizzes/quiz-attempt-questions/validate", {
            method: "POST",
            ...(traceId ? { headers: traceHeaders(traceId) } : {}),
            body: JSON.stringify(input),
        });
    }

    validatePreview(input: QuizPreviewValidationInput) {
        return this.request<QuizPreviewValidationResponse>("/quizzes/questions/validate-preview", {
            method: "POST",
            body: JSON.stringify(input),
        });
    }

    revealHint(attemptId: string, questionId: string) {
        return this.request<QuizHintRevealResponse>(
            `/quizzes/attempts/${encodeURIComponent(attemptId)}/questions/${encodeURIComponent(questionId)}/hints/reveal`,
            { method: "POST" },
        );
    }

    revealAnswer(attemptId: string, questionId: string) {
        return this.request<QuizAnswerRevealResponse>(
            `/quizzes/attempts/${encodeURIComponent(attemptId)}/questions/${encodeURIComponent(questionId)}/answer/reveal`,
            { method: "POST" },
        );
    }

    reopenQuestion(attemptId: string, questionId: string) {
        return this.request<QuizReopenResponse>(
            `/quizzes/attempts/${encodeURIComponent(attemptId)}/questions/${encodeURIComponent(questionId)}/reopen`,
            { method: "POST" },
        );
    }

    registerViolation(attemptId: string, input: QuizViolationInput) {
        return this.request<QuizViolationResponse | undefined>(`/quizzes/attempts/${encodeURIComponent(attemptId)}/violations`, {
            method: "POST",
            body: JSON.stringify(input),
        });
    }

    score(attemptId: string) {
        return this.request<QuizScoreResponse>(`/quizzes/attempts/${encodeURIComponent(attemptId)}/score`);
    }

    contestsMine(query: QuizContestsMineQuery = {}) {
        return this.request<QuizContestsMineResponse>(
            `/quizzes/contests/mine${createQuery({ page: query.page, limit: query.limit })}`,
        );
    }

    createContest(input: CreateQuizContestInput) {
        return this.request<CreateQuizContestResponse>("/quizzes/contests", {
            method: "POST",
            body: JSON.stringify(input),
        });
    }
}
