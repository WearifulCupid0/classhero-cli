import type { ThemeMaterial } from "@classhero-cli/api-wrapper";
import {
    isCliActivityBundle,
    type CliActivityBundle,
    type CliContextSnapshot,
    type CliSelectedEntity,
} from "@classhero-cli/plugin-api";
import type {
    ActivityCapability,
    ActivityContext,
    ActivityKind,
    ActivityTargetContext,
} from "../contracts/activity.js";

export class ActivityContextFactory {
    fromCliSnapshot(snapshot: CliContextSnapshot): ActivityContext | undefined {
        const selected = snapshot.activity;
        if (!selected) {
            return undefined;
        }

        if (isCliActivityBundle(selected.value)) {
            return this.fromBundle(
                selected.value,
                selected.name,
                snapshot.discipline,
                snapshot.mission,
            );
        }

        if (!isThemeMaterial(selected.value)) {
            return undefined;
        }

        return this.fromMaterial(
            selected.value,
            snapshot.discipline,
            snapshot.mission,
        );
    }

    fromBundle(
        bundle: CliActivityBundle,
        selectedName?: string,
        discipline?: CliSelectedEntity,
        mission?: CliSelectedEntity,
    ): ActivityContext | undefined {
        const targets = bundle.targets
            .map((target) => target.value)
            .filter(isThemeMaterial)
            .map(toTargetContext)
            .filter(
                (target): target is ActivityTargetContext =>
                    target !== undefined,
            );

        if (targets.length === 0) {
            return undefined;
        }

        const primary = targets[0]!;
        const sourceId = bundle.source?.id;
        const sourceTitle = bundle.source?.name;
        const capabilities = uniqueCapabilities(targets);

        return {
            materialId: primary.materialId,
            themeId: primary.activity.theme_id,
            ...(sourceId === undefined
                ? {}
                : {
                    sourceMissionMaterialId: sourceId,
                    themeMissionMaterialId: sourceId,
                }),
            ...(sourceTitle === undefined ? {} : { sourceTitle }),
            title: selectedName ?? sourceTitle ?? primary.title,
            materialType: primary.materialType,
            kind: primary.capability,
            capabilities,
            targets,
            ...selectionMetadata(discipline, mission),
            activity: primary.activity,
        };
    }

    fromMaterial(
        activity: ThemeMaterial,
        discipline?: CliSelectedEntity,
        mission?: CliSelectedEntity,
    ): ActivityContext {
        const themeMissionMaterialId = firstString(
            activity.theme_mission_material_id,
            activity.themeMissionMaterialId,
        );
        const target = toTargetContext(activity);
        const kind = target?.capability ?? "unknown";
        const targets = target ? [target] : [];

        return {
            materialId: activity.material_id,
            themeId: activity.theme_id,
            ...(themeMissionMaterialId === undefined
                ? {}
                : {
                    themeMissionMaterialId,
                    sourceMissionMaterialId: themeMissionMaterialId,
                }),
            title: activity.title,
            materialType: activity.type,
            kind,
            capabilities: target ? [target.capability] : [],
            targets,
            ...selectionMetadata(discipline, mission),
            activity,
        };
    }
}

export function classifyActivity(activity: ThemeMaterial): ActivityKind {
    const type = activity.type.trim().toLowerCase();

    if (type === "games" || type === "game") {
        return "games";
    }
    if (type.includes("quiz")) {
        return "quiz";
    }
    if (
        type.includes("interactive_path") ||
        type.includes("interactive-path") ||
        type.includes("interactive path")
    ) {
        return "interactive-path";
    }
    if (
        type.includes("code") ||
        typeof activity.code_challenge_language === "string"
    ) {
        return "code";
    }
    if (
        type.includes("assignment") ||
        type.includes("discursive") ||
        (activity.assignment !== null && activity.assignment !== undefined)
    ) {
        return "discursive";
    }

    return "unknown";
}

function toTargetContext(
    activity: ThemeMaterial,
): ActivityTargetContext | undefined {
    const capability = classifyActivity(activity);
    if (capability === "unknown") {
        return undefined;
    }

    return {
        capability,
        materialId: activity.material_id,
        materialType: activity.type,
        title: activity.title,
        activity,
    };
}

function uniqueCapabilities(
    targets: readonly ActivityTargetContext[],
): ActivityCapability[] {
    return [...new Set(targets.map((target) => target.capability))];
}

function selectionMetadata(
    discipline?: CliSelectedEntity,
    mission?: CliSelectedEntity,
): Partial<ActivityContext> {
    return {
        ...(discipline === undefined
            ? {}
            : {
                disciplineId: discipline.id,
                ...(discipline.name === undefined
                    ? {}
                    : { disciplineName: discipline.name }),
            }),
        ...(mission === undefined
            ? {}
            : {
                missionId: mission.id,
                ...(mission.name === undefined
                    ? {}
                    : { missionName: mission.name }),
            }),
    };
}

function isThemeMaterial(value: unknown): value is ThemeMaterial {
    if (!isRecord(value)) {
        return false;
    }

    return ["material_id", "theme_id", "type", "title"].every(
        (key) => typeof value[key] === "string",
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstString(...values: readonly unknown[]): string | undefined {
    return values.find(
        (value): value is string =>
            typeof value === "string" && value.length > 0,
    );
}
