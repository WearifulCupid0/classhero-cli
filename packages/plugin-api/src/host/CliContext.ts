import { createServiceToken } from "../services/ServiceRegistry.js";

/**
 * Readonly selected value exposed by the CLI host to plugins.
 *
 * The wrapper deliberately keeps `value` generic: the host can expose typed
 * ClassHero records without forcing every plugin to depend on their concrete
 * shape.
 */
export interface CliSelectedEntity<T = unknown> {
    readonly id: string;
    readonly name?: string;
    readonly value: T;
}

/**
 * One executable target attached to a logical activity.
 *
 * A ClassHero journey node may represent one study resource while exposing
 * several actions backed by different theme materials, for example a
 * `gamified_quiz` target and a `games` target for the same PDF.
 */
export interface CliActivityTarget<T = unknown> {
    /** Theme-material id consumed by the target-specific API endpoints. */
    readonly id: string;
    /** Raw ClassHero target/material type, such as `games`. */
    readonly type: string;
    /** Human-readable target title. */
    readonly name?: string;
    /** Original target value returned by the ClassHero API. */
    readonly value: T;
}

/**
 * Logical activity selected by the CLI.
 *
 * `source` is present when a Journey Map resource (normally a mission
 * material/PDF) owns the actions. `targets` contains the independently
 * executable ClassHero theme materials attached to that logical activity.
 *
 * A standalone activity is represented by the same contract with no source
 * and exactly one target.
 */
export interface CliActivityBundle<
    TSource = unknown,
    TTarget = unknown,
> {
    /** Stable discriminator for plugins that want to recognize this shape. */
    readonly kind: "classhero-activity-bundle";
    /** Optional journey/resource that owns the attached actions. */
    readonly source?: CliSelectedEntity<TSource>;
    /** One or more executable targets associated with the selected activity. */
    readonly targets: readonly CliActivityTarget<TTarget>[];
}

/** Runtime type guard for {@link CliActivityBundle}. */
export function isCliActivityBundle(
    value: unknown,
): value is CliActivityBundle {
    if (
        typeof value !== "object" ||
        value === null ||
        Array.isArray(value)
    ) {
        return false;
    }

    const record =
        value as Record<string, unknown>;

    return (
        record.kind ===
            "classhero-activity-bundle" &&
        Array.isArray(
            record.targets,
        )
    );
}

/** Immutable view of the current interactive CLI state. */
export interface CliContextSnapshot {
    readonly authenticated: boolean;
    readonly user?: CliSelectedEntity;
    readonly discipline?: CliSelectedEntity;
    readonly mission?: CliSelectedEntity;
    /**
     * Currently selected logical activity.
     *
     * New hosts expose a {@link CliActivityBundle} as `value`; plugins should
     * still tolerate legacy hosts that expose one raw material directly.
     */
    readonly activity?: CliSelectedEntity;
}

/** Host service that exposes the latest readonly CLI context snapshot. */
export interface CliContextProvider {
    getSnapshot(): CliContextSnapshot;
}

/** Service token plugins use to read the current CLI state without mutating it. */
export const CLI_CONTEXT = createServiceToken<CliContextProvider>(
    "classhero.cli.context",
    "Readonly ClassHero CLI authentication and selection context.",
);
