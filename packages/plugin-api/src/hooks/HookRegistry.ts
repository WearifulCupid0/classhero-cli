import type { Disposable } from "../lifecycle/Disposable.js";
import { toDisposable } from "../lifecycle/Disposable.js";
import type { HookMiddleware } from "./Middleware.js";
import type { HookContract, HookPayload, HookResult } from "./types.js";

/** Options controlling middleware order and ownership. */
export interface HookRegistrationOptions {
    /** Higher priorities wrap/run before lower priorities. Defaults to `0`. */
    readonly priority?: number;
    /** Optional plugin/component id used for diagnostics and bulk cleanup. */
    readonly owner?: string;
}

interface HookEntry {
    readonly middleware: HookMiddleware<unknown, unknown>;
    readonly owner: string | undefined;
    readonly priority: number;
    readonly sequence: number;
}

type ValidHookMap<T> = { [K in keyof T]: HookContract<unknown, unknown> };

/**
 * Typed chain-of-responsibility registry.
 *
 * Middleware can inspect/replace the payload by calling `next(newPayload)`,
 * wrap the next handler, alter its result, or short-circuit the chain by
 * returning a result without invoking `next()`.
 *
 * @typeParam THooks - Map from hook names to {@link HookContract} definitions.
 */
export class HookRegistry<THooks extends ValidHookMap<THooks>> {
    private readonly entries = new Map<keyof THooks, HookEntry[]>();
    private sequence = 0;

    /** Registers middleware for one hook. */
    use<K extends keyof THooks>(
        hook: K,
        middleware: HookMiddleware<HookPayload<THooks, K>, HookResult<THooks, K>>,
        options: HookRegistrationOptions = {},
    ): Disposable {
        const entry: HookEntry = {
            middleware: middleware as HookMiddleware<unknown, unknown>,
            owner: options.owner,
            priority: options.priority ?? 0,
            sequence: this.sequence++,
        };

        const bucket = this.entries.get(hook) ?? [];
        bucket.push(entry);
        bucket.sort((a, b) => b.priority - a.priority || a.sequence - b.sequence);
        this.entries.set(hook, bucket);

        return toDisposable(() => {
            const current = this.entries.get(hook);
            if (!current) {
                return;
            }

            const index = current.indexOf(entry);
            if (index >= 0) {
                current.splice(index, 1);
            }

            if (current.length === 0) {
                this.entries.delete(hook);
            }
        });
    }

    /**
     * Executes a hook through all registered middleware.
     *
     * @param terminal - Final handler called when no middleware short-circuits.
     */
    async run<K extends keyof THooks>(
        hook: K,
        payload: HookPayload<THooks, K>,
        terminal: (payload: HookPayload<THooks, K>) => HookResult<THooks, K> | Promise<HookResult<THooks, K>>,
    ): Promise<HookResult<THooks, K>> {
        const middleware = [...(this.entries.get(hook) ?? [])];

        const dispatch = async (index: number, currentPayload: HookPayload<THooks, K>): Promise<HookResult<THooks, K>> => {
            const entry = middleware[index];
            if (!entry) {
                return terminal(currentPayload);
            }

            let nextCalled = false;
            return entry.middleware({
                payload: currentPayload,
                next: async (nextPayload?: unknown): Promise<unknown> => {
                    if (nextCalled) {
                        throw new Error(`Hook middleware for ${String(hook)} called next() more than once.`);
                    }

                    nextCalled = true;
                    return dispatch(
                        index + 1,
                        (nextPayload === undefined ? currentPayload : nextPayload) as HookPayload<THooks, K>,
                    );
                },
            }) as Promise<HookResult<THooks, K>>;
        };

        return dispatch(0, payload);
    }

    /** Removes every middleware associated with an owner id. */
    removeOwner(owner: string): void {
        for (const [hook, bucket] of this.entries) {
            const filtered = bucket.filter((entry) => entry.owner !== owner);
            if (filtered.length === 0) {
                this.entries.delete(hook);
            } else if (filtered.length !== bucket.length) {
                this.entries.set(hook, filtered);
            }
        }
    }
}
