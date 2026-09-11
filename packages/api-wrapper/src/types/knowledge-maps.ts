import type { UnknownRecord } from "./common.js";

export type KnowledgeMapRole = "initial" | "final" | (string & {});

export interface KnowledgeMapNode extends UnknownRecord {
    id: string;
    label: string;
    parent_id: string | null;
    /** Student final-synthesis contributions use `idea` and `doubt`. */
    kind?: "idea" | "doubt" | (string & {});
    /** True only for nodes authored by the student. */
    student_added?: boolean;
}

export interface KnowledgeMapRelation extends UnknownRecord {
    label: string;
    source: string;
    target: string;
}

export interface KnowledgeMapContent extends UnknownRecord {
    nodes: KnowledgeMapNode[];
    relations: KnowledgeMapRelation[];
}

export interface StudentKnowledgeMapVersion extends UnknownRecord {
    version_id: string;
    knowledge_map_id: string;
    theme_id: string;
    student_email: string;
    source_updated_at: string;
    map_content: KnowledgeMapContent;
    status: string;
    created_at: string;
    updated_at: string;
}

export interface KnowledgeMapProgress extends UnknownRecord {
    progress_id: string;
    knowledge_map_id: string;
    theme_id: string;
    student_email: string;
    opened_at: string;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface KnowledgeMapStudentEvaluation extends UnknownRecord {
    status?: string;
    score?: number;
    feedback?: unknown;
    teacher_status?: string | null;
    teacher_bonus_value?: number | null;
    teacher_comment?: string | null;
}

export interface StudentKnowledgeMap extends UnknownRecord {
    knowledge_map_id: string;
    theme_id: string;
    title: string;
    mode: string;
    central_concept: string;
    summary: string;
    instructions: string;
    map_content: KnowledgeMapContent;
    status: string;
    created_by: string;
    published_by: string;
    published_at: string;
    created_at: string;
    updated_at: string;
    map_role: KnowledgeMapRole;
    student_version: StudentKnowledgeMapVersion | null;
    student_progress: KnowledgeMapProgress | null;
    student_evaluation: KnowledgeMapStudentEvaluation | null;
}

export interface StudentKnowledgeMapResponse extends UnknownRecord {
    data: StudentKnowledgeMap;
}

export interface KnowledgeMapProgressResponse extends UnknownRecord {
    data: KnowledgeMapProgress;
}

export interface SaveStudentKnowledgeMapInput {
    nodes: KnowledgeMapNode[];
    relations: KnowledgeMapRelation[];
}

export interface SaveStudentKnowledgeMapResponse extends UnknownRecord {
    data: StudentKnowledgeMapVersion;
}

export interface SubmitStudentKnowledgeMapResult extends UnknownRecord {
    version?: StudentKnowledgeMapVersion;
    evaluation?: KnowledgeMapStudentEvaluation | null;
}

export interface SubmitStudentKnowledgeMapResponse extends UnknownRecord {
    data: SubmitStudentKnowledgeMapResult;
}
