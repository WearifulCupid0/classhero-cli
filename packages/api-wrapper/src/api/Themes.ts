import { Api, createQuery } from "../client/Api.js";
import type {
    ApiDataResponse,
    GenericMessage,
    ThemeBonusDates,
    ThemeClosure,
    ThemeClosureEvaluation,
    ThemeClosureSubmission,
    ThemesByCourseResponse,
    UnknownRecord,
} from "../types/index.js";

/** Mission/theme metadata and access operations. */
export class Themes extends Api {
    byCourse(courseId: string) {
        return this.request<ThemesByCourseResponse>(`/themes/by-course/${encodeURIComponent(courseId)}`);
    }

    closure(themeId: string) {
        return this.request<ThemeClosure>(`/themes/${encodeURIComponent(themeId)}/closure`);
    }

    /** Saves/submits the student's mission closure state. */
    submitClosure(
        themeId: string,
        input: ThemeClosureSubmission,
    ) {
        return this.request<ThemeClosure>(
            `/themes/${encodeURIComponent(themeId)}/closure`,
            {
                method: "POST",
                body: JSON.stringify(input),
            },
        );
    }

    /** Loads the bonus/evaluation produced for a submitted mission closure. */
    closureEvaluation(themeId: string) {
        return this.request<ThemeClosureEvaluation>(
            `/themes/${encodeURIComponent(themeId)}/closure/evaluation`,
        );
    }

    myBonusDates(themeId: string) {
        return this.request<ApiDataResponse<ThemeBonusDates | null>>(`/themes/${encodeURIComponent(themeId)}/my-bonus-dates`);
    }

    registerAccess(themeId: string) {
        return this.request<GenericMessage | UnknownRecord>(`/themes/${encodeURIComponent(themeId)}/register-access`, {
            method: "POST",
        });
    }

    badgeImage(themeId: string, version?: string | number) {
        return this.download(`/themes/${encodeURIComponent(themeId)}/badge-image${createQuery({ v: version })}`);
    }
}
