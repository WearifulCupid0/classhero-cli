import type { StringNullable, UnknownRecord } from "./common.js";

/** Assignment metadata returned to a student. */
export interface StudentAssignment extends UnknownRecord {
    id: string;
    classDisciplineId: StringNullable;
    courseId: string;
    themeId: string;
    title: string;
    description: string;
    order: number;
    statementStoragePath: StringNullable;
    statementFilename: StringNullable;
    dueAt: string;
    publishedAt: string;
    evaluationMode: string;
    executionMode: string;
    allowResubmission: boolean;
    submissionFileType: string;
    hasPhases: boolean;
    supportMaterials: UnknownRecord[];
    latePenaltyMultiplier: number;
}

/** Assignment team member. */
export interface AssignmentTeamMember extends UnknownRecord {
    email: string;
    name: string;
    is_leader: boolean;
}

/** Team associated with a student assignment. */
export interface AssignmentTeam extends UnknownRecord {
    id: string;
    name: string;
    members: AssignmentTeamMember[];
}

/** Current submission state of an assignment. */
export interface AssignmentSubmission extends UnknownRecord {
    deliveredAt?: StringNullable;
    repoUrl?: StringNullable;
    slidesUrl?: StringNullable;
    notes?: StringNullable;
    presentationStatus?: StringNullable;
    presentationNotes?: StringNullable;
    presentedAt?: StringNullable;
    deliveredBy?: string[];
    presentedBy?: string[];
    grade?: number | null;
}

/** Individual grade attached to a team assignment. */
export interface AssignmentIndividualGrade extends UnknownRecord {
    grade: number;
    feedback: string;
    gradedAt: string;
    updatedAt: string;
}

/** Phase metadata used by multi-phase assignments. */
export interface AssignmentPhase extends UnknownRecord {
    id: string;
    assignmentId: string;
    phaseNumber?: number;
    title?: string;
    description?: string;
    dueAt?: StringNullable;
    statementStoragePath?: StringNullable;
    statementFilename?: StringNullable;
    statement_storage_path?: StringNullable;
    statement_filename?: StringNullable;
    submission?: AssignmentSubmission | null;
    individualGrade?: AssignmentIndividualGrade | null;
}

/** One item returned by `/assignments/students/me`. */
export interface StudentAssignmentItem extends UnknownRecord {
    assignment: StudentAssignment;
    team: AssignmentTeam | null;
    submission: AssignmentSubmission | null;
    individualGrade: AssignmentIndividualGrade | null;
    autoEvaluation: UnknownRecord | null;
    phases: AssignmentPhase[];
}

/** Filters used by the student's assignment list. */
export interface StudentAssignmentsQuery {
    courseId?: string;
    themeId?: string;
}

/** Response returned after uploading a student assignment file. */
export interface AssignmentUploadResponse extends UnknownRecord {
    storage_path: string;
}

/** Submission payload used by a multi-phase assignment. */
export interface AssignmentPhaseSubmissionInput {
    repo_url?: string | null;
    notes?: string | null;
    file_key?: string | null;
    status: string;
}

/** Student feedback sent to the teacher for an assignment. */
export interface AssignmentStudentFeedbackInput {
    message: string;
}
