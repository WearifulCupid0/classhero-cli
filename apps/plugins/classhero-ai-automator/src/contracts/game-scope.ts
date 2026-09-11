import type {
    GameMode,
    GameStartPayload,
} from "@classhero-cli/api-wrapper";
import {
    getSourceMissionMaterialId,
    requireActivityTarget,
} from "../context/ActivityTargets.js";
import type {
    ActivityContext,
} from "./activity.js";
import type {
    MissionAutomationContext,
} from "./mission.js";

export type GameExecutionScope =
    | {
        readonly kind: "material";
        readonly activity: ActivityContext;
        readonly missionId: string;
        readonly materialId: string;
        readonly themeMissionMaterialId?: string;
    }
    | {
        readonly kind: "mission";
        readonly mission: MissionAutomationContext;
        readonly missionId: string;
    };

export function materialGameScope(
    context: ActivityContext,
): GameExecutionScope {
    const target =
        requireActivityTarget(
            context,
            "games",
        );

    const themeMissionMaterialId =
        getSourceMissionMaterialId(
            context,
        );

    return {
        kind: "material",
        activity: context,
        missionId: context.themeId,
        materialId: target.materialId,
        ...(themeMissionMaterialId === undefined
            ? {}
            : { themeMissionMaterialId }),
    };
}

export function missionGameScope(
    mission: MissionAutomationContext,
): GameExecutionScope {
    return {
        kind: "mission",
        mission,
        missionId: mission.missionId,
    };
}

export function gameStartPayload(
    scope: GameExecutionScope,
    mode: GameMode,
): GameStartPayload {
    return scope.kind === "mission"
        ? {
            missionId: scope.missionId,
            mode,
        }
        : {
            materialId: scope.materialId,
            mode,
            ...(scope.themeMissionMaterialId === undefined
                ? {}
                : {
                    themeMissionMaterialId:
                        scope.themeMissionMaterialId,
                }),
        };
}
