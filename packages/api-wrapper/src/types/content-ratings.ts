import type { StringNullable, UnknownRecord } from "./common.js";

/** Student rating payload confirmed by the current ClassHero rating dialog. */
export interface ContentRatingSubmission {
    /** Integer star rating from 1 through 5. */
    stars: number;
    /** Required student justification; the web UI limits it to 2000 chars. */
    justification: string;
}

/**
 * Rating record returned by the content-ratings API.
 *
 * The fifth HAR's mission-rating GET response body was not preserved, so only
 * fields directly referenced by the shipped frontend are declared here.
 */
export interface ContentRating extends UnknownRecord {
    stars?: number;
    justification?: StringNullable;
}

/**
 * Result envelope used by some content-rating endpoints.
 *
 * The web client accepts either `{ data: rating }` or the rating record
 * directly, so the typed facade exposes the transport response unchanged.
 */
export interface ContentRatingEnvelope extends UnknownRecord {
    data?: ContentRating | null;
}
