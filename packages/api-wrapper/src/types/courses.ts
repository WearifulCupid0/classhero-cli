import type { NumberNullable, StringNullable, UnknownRecord } from "./common.js";

/** Learning objective configured for a course. */
export interface CourseLearningObjective extends UnknownRecord {
    id: string;
    text: string;
    track?: string;
}

/** Competency configured for a course. */
export interface CourseCompetency extends UnknownRecord {
    id: string;
    text: string;
}

/** Assessment category used by the course assessment policy. */
export interface CourseAssessmentCategory extends UnknownRecord {
    id: string;
    name: string;
    percent: number;
}

/** Course assessment policy. */
export interface CourseAssessmentPolicy extends UnknownRecord {
    xp_percent?: number;
    custom_categories?: CourseAssessmentCategory[];
}

/** Retry policy configured for activities in a course. */
export interface CourseXpPolicy extends UnknownRecord {
    retry_policy?: "unlimited" | "until_correct" | "max_n" | (string & {});
    retry_max_n?: NumberNullable;
}

/** Bonus entry embedded in the student-details payload. */
export interface CourseStudentBonusEntry extends UnknownRecord {
    id: string;
    activityName: string;
    value: number;
    comment: string;
    gradedAt: string;
}

/** External reference configured for a course. */
export interface CourseReference extends UnknownRecord {
    title: string;
    url: string;
    summary?: string;
}

/** Student-facing course statistics. */
export interface CourseStatistics extends UnknownRecord {
    totalMissions?: number;
    publishedMissions?: number;
    totalMaterials?: number;
}

/** Detailed student-facing course configuration. */
export interface CourseStudentDetails extends UnknownRecord {
    courseId: string;
    courseName: string;
    acronym?: string;
    description?: string;
    coverUrl?: StringNullable;
    teacherName?: StringNullable;
    pedagogicalIntent?: StringNullable;
    didacticStyle?: StringNullable;
    learningObjectives?: CourseLearningObjective[];
    competencies?: CourseCompetency[];
    assessmentPolicy?: CourseAssessmentPolicy;
    xpPolicy?: CourseXpPolicy;
    bonusEntries?: CourseStudentBonusEntry[];
    references?: CourseReference[];
    statistics?: CourseStatistics;
}

/** Direct course enrollment returned for the current student. */
export interface DirectEnrollment extends UnknownRecord {
    course_id: string;
    course_name: string;
    acronym?: string;
    description?: string;
    cover_url?: StringNullable;
    enrolled_at?: string;
    status?: string;
}

/** Downloadable/support asset associated with a course. */
export interface CourseAsset extends UnknownRecord {
    id: string;
    type?: "video" | "pdf" | (string & {});
    title?: string;
    description?: StringNullable;
    url: string;
}

/** Response returned by `/courses/student-assets`. */
export interface CourseAssetsResponse extends UnknownRecord {
    data?: {
        assets?: CourseAsset[];
        [key: string]: unknown;
    };
}

/** Bonus entry manipulated through the course bonus-entry endpoints. */
export interface BonusEntry extends UnknownRecord {
    id?: string;
    course_id?: string;
    student_identifier?: string;
    activityName?: string;
    activity_name?: string;
    value?: number;
    amount?: number;
    comment?: string;
    reason?: string;
    gradedAt?: string;
    graded_at?: string;
}

/** Input accepted by bonus-entry create/update operations. */
export interface BonusEntryInput extends UnknownRecord {
    activityName?: string;
    activity_name?: string;
    value?: number;
    amount?: number;
    comment?: string;
    reason?: string;
}
