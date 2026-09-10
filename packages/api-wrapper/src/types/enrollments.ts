import type { StringNullable, UnknownRecord } from "./common.js";

/** Course advertised as individually enrollable to the current student. */
export interface AvailableIndividualCourse extends UnknownRecord {
    course_id: string;
    course_name: string;
    acronym: string;
    description: string;
    cover_url: StringNullable;
    mascot_url: StringNullable;
    status: string;
    visibility: string;
    institution_domains: string[];
    teacher_name: string;
    teacher_avatar_url: StringNullable;
    teacher_email: string;
    self_enrollment_enabled: boolean;
    enrollment_end: StringNullable;
    student_count: number;
    material_count: number;
}

/** Enrollment discovery response. */
export interface AvailableEnrollmentsResponse extends UnknownRecord {
    data: UnknownRecord[];
    individualCourses: AvailableIndividualCourse[];
}

/** User membership returned by the discipline-user eligibility lookup. */
export interface DisciplineUser extends UnknownRecord {
    email?: string;
    name?: string;
    is_assignment_eligible?: boolean;
}

/** Parameters accepted by `/enrollments/discipline-users`. */
export interface DisciplineUsersQuery {
    classDisciplineId: string;
    email: string;
}

/** Payload used to cancel a class/discipline/course enrollment. */
export interface CancelEnrollmentInput {
    type: string;
    class_id?: string;
    discipline_id?: string;
    course_id?: string;
}
