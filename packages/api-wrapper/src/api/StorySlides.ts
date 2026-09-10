import { Api } from "../client/Api.js";
import type {
    GenerateGlossaryExplanationInput,
    GenerateGlossaryExplanationResponse,
    GenerateStorySlidesInput,
    StorySlidesDataResponse,
    StudentStorySlidesResponse,
    UnknownRecord,
    UpdateStorySlideProgressInput,
    UpdateStorySlideProgressResponse,
    UpsertStorySlidesInput,
} from "../types/index.js";

/** Story-slide authoring and student progress operations. */
export class StorySlides extends Api {
    generate(input: GenerateStorySlidesInput) {
        return this.request<StorySlidesDataResponse>("/story-slides/generate", {
            method: "POST",
            body: JSON.stringify(input),
        });
    }

    byTheme(themeId: string) {
        return this.request<StorySlidesDataResponse>(`/story-slides/theme/${encodeURIComponent(themeId)}`);
    }

    upsert(input: UpsertStorySlidesInput) {
        return this.request<StorySlidesDataResponse>("/story-slides", {
            method: "POST",
            body: JSON.stringify(input),
        });
    }

    publish(storySlideId: string) {
        return this.request<StorySlidesDataResponse>(`/story-slides/${encodeURIComponent(storySlideId)}/publish`, {
            method: "POST",
        });
    }

    student(themeId: string) {
        return this.request<StudentStorySlidesResponse>(`/story-slides/theme/${encodeURIComponent(themeId)}/student`);
    }

    updateProgress(storySlideId: string, input: UpdateStorySlideProgressInput) {
        return this.request<UpdateStorySlideProgressResponse>(
            `/story-slides/${encodeURIComponent(storySlideId)}/progress`,
            { method: "POST", body: JSON.stringify(input) },
        );
    }

    delete(storySlideId: string) {
        return this.request<UnknownRecord | undefined>(`/story-slides/${encodeURIComponent(storySlideId)}`, {
            method: "DELETE",
        });
    }

    generateGlossaryExplanation(input: GenerateGlossaryExplanationInput) {
        return this.request<GenerateGlossaryExplanationResponse>("/story-slides/generate-glossary", {
            method: "POST",
            body: JSON.stringify(input),
        });
    }
}
