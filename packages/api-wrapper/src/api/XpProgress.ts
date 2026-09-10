import { Api, createQuery } from "../client/Api.js";
import type {
    NotifyMissingHeroNamesResponse,
    RankingBulkResponse,
    RankingMissionResponse,
    RankingRecalculateResponse,
    XpCardsResponse,
    XpDisciplineTotal,
    XpMissionsResponse,
    XpPositionResponse,
    XpRefreshResponse,
    XpSummary,
} from "../types/index.js";

/** XP totals, mission progress and ranking operations. */
export class XpProgress extends Api {
    summary() {
        return this.request<XpSummary>("/xp-progress/summary");
    }

    cards() {
        return this.request<XpCardsResponse>("/xp-progress/cards");
    }

    disciplineTotal(courseId: string) {
        return this.request<XpDisciplineTotal>(
            `/xp-progress/discipline-total${createQuery({ course_id: courseId })}`,
        );
    }

    missions(courseId: string) {
        return this.request<XpMissionsResponse>(`/xp-progress/missions${createQuery({ course_id: courseId })}`);
    }

    position(disciplineId: string) {
        return this.request<XpPositionResponse>(
            `/xp-progress/position${createQuery({ discipline_id: disciplineId })}`,
        );
    }

    rankingBulk(courseId: string) {
        return this.request<RankingBulkResponse>(
            `/xp-progress/ranking-bulk${createQuery({ course_id: courseId })}`,
        );
    }

    rankingMission(courseId: string, themeId: string, limit?: number) {
        return this.request<RankingMissionResponse>(
            `/xp-progress/ranking-mission${createQuery({
                course_id: courseId,
                theme_id: themeId,
                limit,
            })}`,
        );
    }

    refresh(courseId: string) {
        return this.request<XpRefreshResponse>(`/xp-progress/refresh${createQuery({ course_id: courseId })}`, {
            method: "POST",
        });
    }

    recalculateRanking(courseId: string, trigger = "xp_change") {
        return this.request<RankingRecalculateResponse>(
            `/xp-progress/ranking-recalculate${createQuery({ course_id: courseId, trigger })}`,
            { method: "POST" },
        );
    }

    notifyMissingHeroNames(courseId: string, studentIdentifiers: string[]) {
        return this.request<NotifyMissingHeroNamesResponse>("/xp-progress/notify-missing-hero-names", {
            method: "POST",
            body: JSON.stringify({
                course_id: courseId,
                student_identifiers: studentIdentifiers,
            }),
        });
    }
}
