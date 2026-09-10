import { Api, createQuery } from "../client/Api.js";
import type {
    CreateLearnProfileApplicationInput,
    LearnProfileAdminStudent,
    LearnProfileApplication,
    LearnProfileCurrent,
    LearnProfileQuestionnaire,
    LearnProfileStatus,
    LearnProfileTeacherStudent,
    LearnProfileTeacherSummary,
    LearnProfileTeacherSummaryQuery,
    UnknownRecord,
    UpdateLearnProfileAnswerInput,
    UpdateLearnProfileAnswerResponse,
} from "../types/index.js";

/** Learning-profile questionnaire and student/teacher/admin views. */
export class LearnProfile extends Api {
    status() {
        return this.request<LearnProfileStatus>("/learn-profile/me/status");
    }

    questionnaire() {
        return this.request<LearnProfileQuestionnaire>("/learn-profile/questionnaire/current");
    }

    current() {
        return this.request<LearnProfileCurrent | undefined>("/learn-profile/me/current");
    }

    createApplication(input: CreateLearnProfileApplicationInput) {
        return this.request<LearnProfileApplication>("/learn-profile/me/applications", {
            method: "POST",
            body: JSON.stringify(input),
        });
    }

    application(applicationId: string) {
        return this.request<LearnProfileApplication>(
            `/learn-profile/me/applications/${encodeURIComponent(applicationId)}`,
        );
    }

    updateAnswer(applicationId: string, input: UpdateLearnProfileAnswerInput) {
        return this.request<UpdateLearnProfileAnswerResponse>(
            `/learn-profile/me/applications/${encodeURIComponent(applicationId)}/answers`,
            { method: "PATCH", body: JSON.stringify(input) },
        );
    }

    submit(applicationId: string) {
        return this.request<LearnProfileCurrent | UnknownRecord>(
            `/learn-profile/me/applications/${encodeURIComponent(applicationId)}/submit`,
            { method: "POST", body: JSON.stringify({}) },
        );
    }

    teacherSummary(query: LearnProfileTeacherSummaryQuery = {}) {
        return this.request<LearnProfileTeacherSummary>(
            `/learn-profile/teacher/summary${createQuery({
                course_id: query.course_id,
                class_discipline_id: query.class_discipline_id,
            })}`,
        );
    }

    teacherStudent(studentIdentifier: string) {
        return this.request<LearnProfileTeacherStudent>(
            `/learn-profile/teacher/students/${encodeURIComponent(studentIdentifier)}`,
        );
    }

    adminStudentCurrent(studentIdentifier: string) {
        return this.request<LearnProfileAdminStudent>(
            `/learn-profile/admin/students/${encodeURIComponent(studentIdentifier)}/current`,
        );
    }

    adminStudents() {
        return this.request<LearnProfileAdminStudent[]>("/learn-profile/admin/students");
    }
}
