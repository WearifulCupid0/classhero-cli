import { Api } from "../client/Api.js";
import type {
    ContentRating,
    ContentRatingEnvelope,
    ContentRatingSubmission,
} from "../types/index.js";

/**
 * Student content-rating endpoints.
 *
 * Mission `mine()` is observed in the fifth HAR. Material and submission
 * routes are also confirmed by the frontend bundle captured by that HAR.
 */
export class ContentRatings extends Api {
    materialMine(materialId: string) {
        return this.request<ContentRating | ContentRatingEnvelope>(
            `/content-ratings/material/${encodeURIComponent(materialId)}/mine`,
        );
    }

    rateMaterial(
        materialId: string,
        input: ContentRatingSubmission,
    ) {
        return this.request<ContentRating | ContentRatingEnvelope>(
            `/content-ratings/material/${encodeURIComponent(materialId)}`,
            {
                method: "POST",
                body: JSON.stringify(input),
            },
        );
    }

    missionMine(missionId: string) {
        return this.request<ContentRating | ContentRatingEnvelope>(
            `/content-ratings/mission/${encodeURIComponent(missionId)}/mine`,
        );
    }

    rateMission(
        missionId: string,
        input: ContentRatingSubmission,
    ) {
        return this.request<ContentRating | ContentRatingEnvelope>(
            `/content-ratings/mission/${encodeURIComponent(missionId)}`,
            {
                method: "POST",
                body: JSON.stringify(input),
            },
        );
    }
}
