import type {
    ActivityCapability,
    ActivityContext,
    ActivityTargetContext,
} from "../contracts/activity.js";

/** Returns the first concrete ThemeMaterial backing a capability. */
export function getActivityTarget(
    context: ActivityContext,
    capability: ActivityCapability,
): ActivityTargetContext | undefined {
    return context.targets.find(
        (target) => target.capability === capability,
    );
}

/** Returns a required concrete target or throws a descriptive executor error. */
export function requireActivityTarget(
    context: ActivityContext,
    capability: ActivityCapability,
): ActivityTargetContext {
    const target = getActivityTarget(context, capability);

    if (!target) {
        throw new Error(
            `A atividade lógica não possui um target '${capability}'.`,
        );
    }

    return target;
}

/** Mission-material/PDF id associated with this logical activity, when any. */
export function getSourceMissionMaterialId(
    context: ActivityContext,
): string | undefined {
    return (
        context.sourceMissionMaterialId ??
        context.themeMissionMaterialId
    );
}
