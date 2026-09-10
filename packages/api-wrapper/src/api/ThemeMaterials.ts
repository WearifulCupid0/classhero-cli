import { Api, appendBlob } from "../client/Api.js";
import type {
    AdaptiveBrainMarkdownAvailability,
    BrainMarkdown,
    CodeChallengeFeedbackInput,
    CreateMaterialAccessSessionInput,
    CreateMaterialAccessSessionResponse,
    GenericMessage,
    InteractivePathCreditBalance,
    MissionMaterial,
    StartGamifiedInteractivePathInput,
    StartGamifiedInteractivePathResponse,
    SubmitGamifiedInteractivePathStepInput,
    SubmitGamifiedInteractivePathStepResponse,
    ThemeMaterial,
    ThemeMaterialFeedbackInput,
    ThemeMaterialFeedbackResponse,
    UpdateMaterialAccessSessionInput,
} from "../types/index.js";

function feedbackForm(input: ThemeMaterialFeedbackInput): FormData {
    const form = new FormData();

    form.append("attempt_id", input.attemptId);
    form.append("step_id", input.stepId);
    form.append("message", input.message.trim());

    if (input.idempotencyKey) {
        form.append("idempotency_key", input.idempotencyKey);
    }

    appendBlob(form, "attachment", input.attachment, input.filename);

    return form;
}

/** Material retrieval, progress, interactive-path and feedback operations. */
export class ThemeMaterials extends Api {
    byTheme(themeId: string) {
        return this.request<ThemeMaterial[]>(`/theme-materials/by-theme/${encodeURIComponent(themeId)}`);
    }

    missionMaterials(themeId: string) {
        return this.request<MissionMaterial[]>(`/themes/${encodeURIComponent(themeId)}/mission-materials`);
    }

    adaptiveBrainMarkdownAvailability(themeId: string, themeMissionMaterialId: string) {
        return this.request<AdaptiveBrainMarkdownAvailability>(
            `/themes/${encodeURIComponent(themeId)}/mission-materials/${encodeURIComponent(themeMissionMaterialId)}/adaptive-brain-markdown/availability`,
        );
    }

    brainMarkdown(themeId: string, themeMissionMaterialId: string) {
        return this.request<BrainMarkdown>(
            `/themes/${encodeURIComponent(themeId)}/mission-materials/${encodeURIComponent(themeMissionMaterialId)}/brain-markdown`,
        );
    }

    streamPdf(themeId: string, themeMissionMaterialId: string) {
        return this.download(
            `/themes/${encodeURIComponent(themeId)}/mission-materials/${encodeURIComponent(themeMissionMaterialId)}/stream-pdf`,
        );
    }

    downloadVideo(themeId: string, themeMissionMaterialId: string) {
        return this.download(
            `/themes/${encodeURIComponent(themeId)}/mission-materials/${encodeURIComponent(themeMissionMaterialId)}/download-video`,
        );
    }

    createAccessSession(themeMissionMaterialId: string, input: CreateMaterialAccessSessionInput) {
        return this.request<CreateMaterialAccessSessionResponse>(
            `/theme-materials/mission-materials/${encodeURIComponent(themeMissionMaterialId)}/access-session`,
            { method: "POST", body: JSON.stringify(input) },
        );
    }

    updateAccessSession(accessSessionId: string, input: UpdateMaterialAccessSessionInput) {
        return this.request<GenericMessage>(
            `/theme-materials/mission-materials/access-sessions/${encodeURIComponent(accessSessionId)}`,
            { method: "PATCH", body: JSON.stringify(input) },
        );
    }

    startGamifiedInteractivePath(input: StartGamifiedInteractivePathInput) {
        return this.request<StartGamifiedInteractivePathResponse>(
            "/theme-materials/gamified-interactive-path/attempts/start",
            { method: "POST", body: JSON.stringify(input) },
        );
    }

    submitGamifiedInteractivePathStep(input: SubmitGamifiedInteractivePathStepInput) {
        return this.request<SubmitGamifiedInteractivePathStepResponse>(
            "/theme-materials/gamified-interactive-path/attempts/step",
            { method: "POST", body: JSON.stringify(input) },
        );
    }

    gamifiedInteractivePathCreditBalance(attemptId: string) {
        return this.request<InteractivePathCreditBalance>(
            `/theme-materials/gamified-interactive-path/attempts/${encodeURIComponent(attemptId)}/credits/balance`,
        );
    }

    interactivePathFeedback(input: ThemeMaterialFeedbackInput) {
        return this.request<ThemeMaterialFeedbackResponse>("/theme-materials/interactive-path/feedback", {
            method: "POST",
            body: feedbackForm(input),
        });
    }

    gamifiedInteractivePathFeedback(input: ThemeMaterialFeedbackInput) {
        return this.request<ThemeMaterialFeedbackResponse>("/theme-materials/gamified-interactive-path/feedback", {
            method: "POST",
            body: feedbackForm(input),
        });
    }

    codeChallengeFeedback(input: CodeChallengeFeedbackInput) {
        const form = new FormData();

        form.append("attempt_id", input.attemptId);
        form.append("submission_id", input.submissionId);
        form.append("message", input.message.trim());

        if (input.idempotencyKey) {
            form.append("idempotency_key", input.idempotencyKey);
        }

        appendBlob(form, "attachment", input.attachment, input.filename);

        return this.request<ThemeMaterialFeedbackResponse>(
            `/theme-materials/${encodeURIComponent(input.materialId)}/code-challenge-gamified/feedback`,
            { method: "POST", body: form },
        );
    }
}
