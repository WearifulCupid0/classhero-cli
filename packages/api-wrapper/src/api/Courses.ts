import { Api, createQuery } from "../client/Api.js";
import type {
    ApiDataResponse,
    BonusEntry,
    BonusEntryInput,
    CourseAssetsResponse,
    CourseStudentDetails,
    DirectEnrollment,
} from "../types/index.js";

/** Course metadata, assets, direct enrollments and bonus-entry operations. */
export class Courses extends Api {
    studentDetails(courseId: string) {
        return this.request<ApiDataResponse<CourseStudentDetails> | CourseStudentDetails>(
            `/courses/${encodeURIComponent(courseId)}/student-details`,
        );
    }

    streamCover(courseId: string) {
        return this.download(`/courses/${encodeURIComponent(courseId)}/stream-cover`);
    }

    streamMascot(courseId: string) {
        return this.download(`/courses/${encodeURIComponent(courseId)}/stream-mascote`);
    }

    directEnrollments() {
        return this.request<ApiDataResponse<DirectEnrollment[]>>("/courses/me/direct-enrollments");
    }

    studentAssets(input: { courseId?: string; classDisciplineId?: string }) {
        const query = createQuery({
            course_id: input.courseId,
            class_discipline_id: input.classDisciplineId,
        });

        return this.request<CourseAssetsResponse>(`/courses/student-assets${query}`);
    }

    downloadAsset(path: string) {
        return this.download(path);
    }

    bonusEntries(courseId: string, studentIdentifier: string) {
        return this.request<BonusEntry[]>(
            `/courses/${encodeURIComponent(courseId)}/bonus-entries/${encodeURIComponent(studentIdentifier)}`,
        );
    }

    myBonusEntries(courseId: string) {
        return this.request<BonusEntry[]>(`/courses/${encodeURIComponent(courseId)}/bonus-entries/me`);
    }

    createBonusEntry(courseId: string, studentIdentifier: string, input: BonusEntryInput) {
        return this.request<BonusEntry>(
            `/courses/${encodeURIComponent(courseId)}/bonus-entries/${encodeURIComponent(studentIdentifier)}`,
            { method: "POST", body: JSON.stringify(input) },
        );
    }

    createBonusEntriesBulk(courseId: string, input: BonusEntryInput | BonusEntryInput[]) {
        return this.request<BonusEntry[]>(`/courses/${encodeURIComponent(courseId)}/bonus-entries/bulk`, {
            method: "POST",
            body: JSON.stringify(input),
        });
    }

    updateBonusEntry(courseId: string, studentIdentifier: string, entryId: string, input: BonusEntryInput) {
        return this.request<BonusEntry>(
            `/courses/${encodeURIComponent(courseId)}/bonus-entries/${encodeURIComponent(studentIdentifier)}/${encodeURIComponent(entryId)}`,
            { method: "PATCH", body: JSON.stringify(input) },
        );
    }

    deleteBonusEntry(courseId: string, studentIdentifier: string, entryId: string) {
        return this.request<void>(
            `/courses/${encodeURIComponent(courseId)}/bonus-entries/${encodeURIComponent(studentIdentifier)}/${encodeURIComponent(entryId)}`,
            { method: "DELETE" },
        );
    }
}
