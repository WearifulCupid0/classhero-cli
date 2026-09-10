import { createServiceToken } from "../services/ServiceRegistry.js";

/** Readonly selected value exposed by the CLI host to plugins. */
export interface CliSelectedEntity<T = unknown> {
    readonly id: string;
    readonly name?: string;
    readonly value: T;
}

/** Immutable view of the current interactive CLI state. */
export interface CliContextSnapshot {
    readonly authenticated: boolean;
    readonly user?: CliSelectedEntity;
    readonly discipline?: CliSelectedEntity;
    readonly mission?: CliSelectedEntity;
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
