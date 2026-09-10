import { Api, appendBlob, createQuery } from "../client/Api.js";
import type {
    AssignmentPhaseSubmissionInput,
    AssignmentStudentFeedbackInput,
    AssignmentUploadResponse,
    GenericMessage,
    StudentAssignmentItem,
    StudentAssignmentsQuery,
    UnknownRecord,
} from "../types/index.js";

/** Student assignment endpoints used by mission/task flows in the web client. */
export class Assignments extends Api {
    mine(input: StudentAssignmentsQuery = {}) {
        return this.request<StudentAssignmentItem[]>(`/assignments/students/me${createQuery({
            course_id: input.courseId,
            theme_id: input.themeId,
        })}`);
    }

    streamStatement(assignmentId: string) {
        return this.download(`/assignments/${encodeURIComponent(assignmentId)}/stream-statement`);
    }

    streamPhaseStatement(assignmentId: string, phaseId: string) {
        return this.download(
            `/assignments/${encodeURIComponent(assignmentId)}/phases/${encodeURIComponent(phaseId)}/stream-statement`,
        );
    }

    streamFilePath(path: string) {
        return this.download(`/assignments/stream-file-path${createQuery({ path })}`);
    }

    uploadStudentFile(assignmentId: string, file: Blob, filename?: string) {
        const form = new FormData();
        appendBlob(form, "file", file, filename);

        return this.request<AssignmentUploadResponse>(
            `/assignments/${encodeURIComponent(assignmentId)}/student-upload`,
            { method: "POST", body: form },
        );
    }

    submitPhase(
        assignmentId: string,
        teamId: string | null | undefined,
        phaseId: string,
        input: AssignmentPhaseSubmissionInput,
    ) {
        const resolvedTeamId = teamId?.trim() || "individual";

        return this.request<GenericMessage | UnknownRecord>(
            `/assignments/${encodeURIComponent(assignmentId)}/teams/${encodeURIComponent(resolvedTeamId)}/phases/${encodeURIComponent(phaseId)}/submission`,
            { method: "PUT", body: JSON.stringify(input) },
        );
    }

    sendStudentFeedback(assignmentId: string, input: AssignmentStudentFeedbackInput | string) {
        const payload: AssignmentStudentFeedbackInput = typeof input === "string" ? { message: input } : input;

        return this.request<GenericMessage | UnknownRecord>(
            `/assignments/${encodeURIComponent(assignmentId)}/student-feedback`,
            { method: "POST", body: JSON.stringify(payload) },
        );
    }
}
