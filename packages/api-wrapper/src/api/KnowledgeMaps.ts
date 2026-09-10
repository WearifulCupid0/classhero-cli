import { Api } from "../client/Api.js";
import type {
    KnowledgeMapProgressResponse,
    KnowledgeMapRole,
    SaveStudentKnowledgeMapInput,
    SaveStudentKnowledgeMapResponse,
    StudentKnowledgeMapResponse,
    SubmitStudentKnowledgeMapResponse,
} from "../types/index.js";

/** Student knowledge-map retrieval, autosave, submission and progress operations. */
export class KnowledgeMaps extends Api {
    student(missionId: string, role: KnowledgeMapRole) {
        return this.request<StudentKnowledgeMapResponse>(
            `/missions/${encodeURIComponent(missionId)}/knowledge-maps/${encodeURIComponent(role)}/student`,
        );
    }

    initial(missionId: string) {
        return this.student(missionId, "initial");
    }

    final(missionId: string) {
        return this.student(missionId, "final");
    }

    markOpened(missionId: string, role: KnowledgeMapRole) {
        return this.request<KnowledgeMapProgressResponse>(
            `/missions/${encodeURIComponent(missionId)}/knowledge-maps/${encodeURIComponent(role)}/student/opened`,
            { method: "POST" },
        );
    }

    save(missionId: string, role: KnowledgeMapRole, input: SaveStudentKnowledgeMapInput) {
        return this.request<SaveStudentKnowledgeMapResponse>(
            `/missions/${encodeURIComponent(missionId)}/knowledge-maps/${encodeURIComponent(role)}/student`,
            { method: "POST", body: JSON.stringify(input) },
        );
    }

    submit(missionId: string, role: KnowledgeMapRole, input: SaveStudentKnowledgeMapInput) {
        return this.request<SubmitStudentKnowledgeMapResponse>(
            `/missions/${encodeURIComponent(missionId)}/knowledge-maps/${encodeURIComponent(role)}/student/submit`,
            { method: "POST", body: JSON.stringify(input) },
        );
    }
}
