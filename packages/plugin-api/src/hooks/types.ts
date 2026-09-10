import type { ApiRequestOptions, ApiResponse } from "@classhero-cli/api-wrapper";
import type { AnyPromptDefinition, PromptRenderResult } from "../prompts/types.js";

/** Type-only contract describing the payload/result pair of one hook. */
export interface HookContract<TPayload, TResult> {
    readonly payload: TPayload;
    readonly result: TResult;
}

/** Extracts a hook payload from a hook-definition map. */
export type HookPayload<THooks, K extends keyof THooks> = THooks[K] extends HookContract<infer P, unknown>
    ? P
    : never;

/** Extracts a hook result from a hook-definition map. */
export type HookResult<THooks, K extends keyof THooks> = THooks[K] extends HookContract<unknown, infer R>
    ? R
    : never;

/** Base metadata shared by prompt hooks. */
export interface PromptHookPayload {
    /** Prompt definition currently being processed. */
    readonly definition: AnyPromptDefinition;
}

/** Payload used before rendering or resolving a prompt. */
export interface PromptBeforeHookPayload extends PromptHookPayload {}

/** Payload used to let plugins resolve a prompt without showing the renderer. */
export interface PromptResolveHookPayload extends PromptHookPayload {}

/** Payload emitted after a prompt produced a submitted/cancelled result. */
export interface PromptAfterHookPayload extends PromptHookPayload {
    readonly result: PromptRenderResult<unknown>;
}

/** Payload for lifecycle hooks emitted by the CLI runtime. */
export interface CliLifecycleHookPayload {
    readonly timestamp: Date;
}

/** Payload used when a session becomes authenticated. */
export interface SessionAuthenticatedHookPayload {
    readonly user: unknown;
}

/** Generic payload for discipline, mission and activity selections. */
export interface SelectionHookPayload<T = unknown> {
    readonly id: string;
    readonly name?: string;
    readonly value: T;
}

/** Request data exposed to API middleware. */
export interface ApiBeforeRequestHookPayload {
    readonly path: string;
    readonly options: ApiRequestOptions;
}

/** Successful/HTTP response data exposed to API middleware. */
export interface ApiAfterResponseHookPayload {
    readonly path: string;
    readonly response: ApiResponse<unknown>;
}

/** Failure data exposed to API middleware. */
export interface ApiErrorHookPayload {
    readonly path: string;
    readonly error: unknown;
}

/**
 * Built-in hook map understood by the ClassHero CLI plugin runtime.
 *
 * Hosts may create their own `HookRegistry` with an extended map when they
 * need additional application-specific hooks.
 */
export interface CoreHookMap {
    "cli:starting": HookContract<CliLifecycleHookPayload, void>;
    "cli:ready": HookContract<CliLifecycleHookPayload, void>;
    "cli:stopping": HookContract<CliLifecycleHookPayload, void>;
    "session:authenticated": HookContract<SessionAuthenticatedHookPayload, void>;
    "session:cleared": HookContract<void, void>;
    "discipline:selected": HookContract<SelectionHookPayload, void>;
    "mission:selected": HookContract<SelectionHookPayload, void>;
    "activity:selected": HookContract<SelectionHookPayload, void>;
    "prompt:before": HookContract<PromptBeforeHookPayload, AnyPromptDefinition>;
    "prompt:resolve": HookContract<PromptResolveHookPayload, PromptRenderResult<unknown> | undefined>;
    "prompt:after": HookContract<PromptAfterHookPayload, PromptRenderResult<unknown>>;
    "api:beforeRequest": HookContract<ApiBeforeRequestHookPayload, ApiBeforeRequestHookPayload>;
    "api:afterResponse": HookContract<ApiAfterResponseHookPayload, ApiAfterResponseHookPayload>;
    "api:error": HookContract<ApiErrorHookPayload, ApiErrorHookPayload>;
}
