import type {
    AuthenticatedUser,
    JourneyMapNode,
    MissionMaterial,
    StudentDiscipline,
    ThemeMaterial,
    XpMission,
} from "@classhero-cli/api-wrapper";
import type {
    CliActivityBundle,
    CliContextProvider,
    CliContextSnapshot,
    CliSelectedEntity,
} from "@classhero-cli/plugin-api";

/** Discipline selection retained by the interactive session. */
export interface SelectedDiscipline {
    readonly id: string;
    readonly classDisciplineId: string;
    readonly courseId: string | null;
    readonly name: string;
    readonly value: StudentDiscipline;
}

/** Mission selection retained by the interactive session. */
export interface SelectedMission {
    readonly id: string;
    readonly name: string;
    readonly value: XpMission;
}

/** Source values currently used by logical activity bundles. */
export type SelectedActivitySource =
    | MissionMaterial
    | JourneyMapNode;

/** Value exposed to plugins for the current logical activity. */
export type SelectedActivityBundle =
    CliActivityBundle<
        SelectedActivitySource,
        ThemeMaterial
    >;

/** Logical activity retained by the interactive session. */
export interface SelectedActivity {
    readonly id: string;
    readonly name: string;
    readonly value: SelectedActivityBundle;
}

/** Mutable application state owned exclusively by the CLI host. */
export class AppContext implements CliContextProvider {
    private authenticatedUser: AuthenticatedUser | undefined;
    private selectedDiscipline: SelectedDiscipline | undefined;
    private selectedMission: SelectedMission | undefined;
    private selectedActivity: SelectedActivity | undefined;

    get authenticated(): boolean {
        return this.authenticatedUser !== undefined;
    }

    get user(): AuthenticatedUser | undefined {
        return this.authenticatedUser;
    }

    get discipline(): SelectedDiscipline | undefined {
        return this.selectedDiscipline;
    }

    get mission(): SelectedMission | undefined {
        return this.selectedMission;
    }

    get activity(): SelectedActivity | undefined {
        return this.selectedActivity;
    }

    setAuthenticated(user: AuthenticatedUser): void {
        this.authenticatedUser = user;
    }

    clearAuthentication(): void {
        this.authenticatedUser = undefined;
        this.clearSelections();
    }

    selectDiscipline(discipline: StudentDiscipline): void {
        this.selectedDiscipline = {
            id: discipline.class_discipline_id,
            classDisciplineId: discipline.class_discipline_id,
            courseId: discipline.course_id,
            name: discipline.name,
            value: discipline,
        };
        this.selectedMission = undefined;
        this.selectedActivity = undefined;
    }

    selectMission(mission: XpMission): void {
        this.selectedMission = {
            id: mission.theme_id,
            name: mission.mission_title,
            value: mission,
        };
        this.selectedActivity = undefined;
    }

    /** Stores one logical activity assembled by {@link ActivityFlow}. */
    selectActivity(
        id: string,
        name: string,
        value: SelectedActivityBundle,
    ): void {
        this.selectedActivity = {
            id,
            name,
            value,
        };
    }

    clearSelections(): void {
        this.selectedDiscipline = undefined;
        this.selectedMission = undefined;
        this.selectedActivity = undefined;
    }

    getSnapshot(): CliContextSnapshot {
        return {
            authenticated: this.authenticated,
            ...(this.authenticatedUser === undefined
                ? {}
                : {
                    user: toSelectedEntity(
                        this.authenticatedUser.email,
                        this.authenticatedUser.name,
                        this.authenticatedUser,
                    ),
                }),
            ...(this.selectedDiscipline === undefined
                ? {}
                : {
                    discipline: toSelectedEntity(
                        this.selectedDiscipline.id,
                        this.selectedDiscipline.name,
                        this.selectedDiscipline.value,
                    ),
                }),
            ...(this.selectedMission === undefined
                ? {}
                : {
                    mission: toSelectedEntity(
                        this.selectedMission.id,
                        this.selectedMission.name,
                        this.selectedMission.value,
                    ),
                }),
            ...(this.selectedActivity === undefined
                ? {}
                : {
                    activity: toSelectedEntity(
                        this.selectedActivity.id,
                        this.selectedActivity.name,
                        this.selectedActivity.value,
                    ),
                }),
        };
    }
}

function toSelectedEntity<T>(
    id: string,
    name: string,
    value: T,
): CliSelectedEntity<T> {
    return {
        id,
        name,
        value,
    };
}
