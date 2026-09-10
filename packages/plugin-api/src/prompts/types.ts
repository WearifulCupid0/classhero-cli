/** Supported prompt families understood by the core prompt host. */
export type PromptKind = "text" | "confirm" | "select" | "multiselect" | "custom";

/** Callback executed after an option becomes the final submitted selection. */
export type MenuOptionHandler<T> = (value: T) => void | Promise<void>;

/** Stable menu option consumed by `select` and `multiselect` prompts. */
export interface MenuOption<T> {
    /** Stable option identifier used by plugins when inserting/removing items. */
    readonly id: string;
    /** Value returned when the option is selected. */
    readonly value: T;
    /** Human-readable label shown by the renderer. */
    readonly label: string;
    /** Optional secondary text. */
    readonly hint?: string;
    /** `true` or a message when the option is not selectable. */
    readonly disabled?: boolean | string;
    /**
     * Optional behavior associated with this option.
     *
     * The callback is executed by {@link PromptHost} only after prompt hooks
     * have produced the final submitted result. This lets plugins inject both
     * a menu entry and its flow without the host application knowing the
     * plugin-specific value beforehand.
     */
    readonly onSelect?: MenuOptionHandler<T>;
}

/** Common fields shared by every prompt. */
export interface BasePromptDefinition<TKind extends PromptKind> {
    /** Stable prompt id used by hooks and menu contributions. */
    readonly id: string;
    /** Prompt family. */
    readonly kind: TKind;
    /** Primary message shown to the user. */
    readonly message: string;
    /** Arbitrary host/plugin metadata not interpreted by the SDK. */
    readonly metadata?: Readonly<Record<string, unknown>>;
}

/** Text-input prompt. */
export interface TextPromptDefinition extends BasePromptDefinition<"text"> {
    readonly placeholder?: string;
    readonly initialValue?: string;
    /** Requests a masked/secret input when supported by the renderer. */
    readonly secret?: boolean;
    /** Optional renderer-neutral validation callback. */
    readonly validate?: (value: string) => string | undefined;
}

/** Boolean confirmation prompt. */
export interface ConfirmPromptDefinition extends BasePromptDefinition<"confirm"> {
    readonly initialValue?: boolean;
    readonly activeLabel?: string;
    readonly inactiveLabel?: string;
}

/** Single-choice prompt. */
export interface SelectPromptDefinition<T> extends BasePromptDefinition<"select"> {
    readonly options: readonly MenuOption<T>[];
    readonly initialValue?: T;
    /** Requests a searchable/autocomplete presentation when supported. */
    readonly searchable?: boolean;
}

/** Multi-choice prompt. */
export interface MultiSelectPromptDefinition<T> extends BasePromptDefinition<"multiselect"> {
    readonly options: readonly MenuOption<T>[];
    readonly initialValues?: readonly T[];
    readonly required?: boolean;
}

/**
 * Escape hatch for renderer-specific flows.
 *
 * The host still executes prompt hooks, but interpretation of `renderer` and
 * `payload` belongs entirely to the CLI renderer implementation.
 */
export interface CustomPromptDefinition<T = unknown> extends BasePromptDefinition<"custom"> {
    readonly renderer: string;
    readonly payload?: unknown;
    readonly __resultType?: T;
}

/** Union accepted by {@link PromptRenderer}. */
export type AnyPromptDefinition =
    | TextPromptDefinition
    | ConfirmPromptDefinition
    | SelectPromptDefinition<unknown>
    | MultiSelectPromptDefinition<unknown>
    | CustomPromptDefinition<unknown>;

/** Successful prompt result. */
export interface SubmittedPromptResult<T> {
    readonly status: "submitted";
    readonly value: T;
}

/** Cancelled prompt result. */
export interface CancelledPromptResult {
    readonly status: "cancelled";
    readonly reason?: string;
}

/** Renderer-independent result returned by {@link PromptHost}. */
export type PromptRenderResult<T> = SubmittedPromptResult<T> | CancelledPromptResult;

/** Convenience helper for a submitted result. */
export function submitted<T>(value: T): SubmittedPromptResult<T> {
    return { status: "submitted", value };
}

/** Convenience helper for a cancelled result. */
export function cancelled(reason?: string): CancelledPromptResult {
    return reason === undefined ? { status: "cancelled" } : { status: "cancelled", reason };
}
