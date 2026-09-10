import type { UnknownRecord } from "./common.js";

export type StorySlideType = "intro" | "content" | "checkpoint" | "summary" | "action" | (string & {});
export type StorySlideAnimation =
    | "fade_in"
    | "slide_left"
    | "slide_right"
    | "slide_up"
    | "zoom_in"
    | "none"
    | (string & {});

export interface StorySlideGlossaryEntry extends UnknownRecord {
    term: string;
    explanation: string;
}

export interface StorySlideContent extends UnknownRecord {
    type: StorySlideType;
    order: number;
    title: string;
    mascot?: string;
    content: string;
    glossary?: StorySlideGlossaryEntry[];
    animation?: StorySlideAnimation;
    background_theme?: string;
    mascot_expression?: string;
}

export interface StorySlide extends UnknownRecord {
    story_slide_id: string;
    theme_id: string;
    status: string;
    title: string;
    description: string | null;
    estimated_duration_minutes: number;
    slides_content: StorySlideContent[];
    created_by: string;
    created_at: string;
    updated_at: string;
    published_at: string | null;
}

export interface StorySlideProgress extends UnknownRecord {
    progress_id: string;
    story_slide_id: string;
    student_email: string;
    current_slide: number;
    completed_slides: number[];
    is_completed: boolean;
    completed_at: string | null;
    total_time_seconds: number;
    started_at: string;
    last_viewed_at: string;
    updated_at: string;
}

export interface StudentStorySlidesData extends UnknownRecord {
    storySlide: StorySlide;
    progress: StorySlideProgress | null;
}

export interface StudentStorySlidesResponse extends UnknownRecord {
    success: boolean;
    data: StudentStorySlidesData;
}

export interface UpdateStorySlideProgressInput {
    current_slide: number;
    completed_slides: number[];
    time_spent_seconds: number;
}

export interface UpdateStorySlideProgressResponse extends UnknownRecord {
    success: boolean;
    data: StorySlideProgress;
}

export interface GenerateStorySlidesInput extends UnknownRecord {
    theme_id: string;
    style_hint?: string;
    terms_to_explain?: string[];
}

export interface StorySlidesDataResponse extends UnknownRecord {
    data: StorySlide;
}

export interface UpsertStorySlidesInput extends UnknownRecord {
    theme_id: string;
    title: string;
    description?: string | null;
    estimated_duration_minutes?: number;
    slides: StorySlideContent[];
}

export interface GenerateGlossaryExplanationInput extends UnknownRecord {
    term?: string;
    terms?: string[];
    context?: string;
    theme_id?: string;
}

export interface GenerateGlossaryExplanationResponse extends UnknownRecord {
    data: UnknownRecord | string;
}
