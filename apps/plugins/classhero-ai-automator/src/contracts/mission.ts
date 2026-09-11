import type {
    CliContextSnapshot,
} from "@classhero-cli/plugin-api";

/** Mission-wide context for actions that are not attached to one ThemeMaterial. */
export interface MissionAutomationContext {
    readonly missionId: string;
    readonly title: string;
    readonly courseId?: string;
    readonly disciplineId?: string;
    readonly disciplineName?: string;
}

/** Mission-level bonus games currently shipped by the ClassHero launcher. */
export type MissionBonusGameTargetId =
    | "word-search"
    | "memory"
    | "hangman";

/** Builds mission context from the readonly CLI snapshot. */
export function missionContextFromSnapshot(
    snapshot: CliContextSnapshot,
): MissionAutomationContext | undefined {
    const mission = snapshot.mission;

    if (!mission) {
        return undefined;
    }

    const value = isRecord(mission.value)
        ? mission.value
        : undefined;

    const courseId = value && typeof value.course_id === "string"
        ? value.course_id
        : undefined;

    return {
        missionId: mission.id,
        title: mission.name ?? "Missão selecionada",
        ...(courseId === undefined ? {} : { courseId }),
        ...(snapshot.discipline === undefined
            ? {}
            : {
                disciplineId: snapshot.discipline.id,
                ...(snapshot.discipline.name === undefined
                    ? {}
                    : { disciplineName: snapshot.discipline.name }),
            }),
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
