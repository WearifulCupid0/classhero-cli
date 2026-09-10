import { Api, createQuery } from "../client/Api.js";
import type {
    AvailableEnrollmentsResponse,
    CancelEnrollmentInput,
    DisciplineUser,
    DisciplineUsersQuery,
    GenericMessage,
} from "../types/index.js";

/** Student enrollment discovery, eligibility and cancellation operations. */
export class Enrollments extends Api {
    available() {
        return this.request<AvailableEnrollmentsResponse>("/enrollments/available");
    }

    disciplineUsers(input: DisciplineUsersQuery) {
        return this.request<DisciplineUser[]>(`/enrollments/discipline-users${createQuery({
            classDisciplineId: input.classDisciplineId,
            email: input.email,
        })}`);
    }

    cancel(input: CancelEnrollmentInput) {
        return this.request<GenericMessage>("/enrollments/cancel", {
            method: "PATCH",
            body: JSON.stringify(input),
        });
    }
}
