import type { Disposable } from "../lifecycle/Disposable.js";
import { toDisposable } from "../lifecycle/Disposable.js";

/** Map whose keys are event names and values are their payload types. */
export type EventMap = Record<string, unknown>;

/** Event listener callback. */
export type EventListener<T> = (payload: T) => void | Promise<void>;

/** Options for event subscriptions. */
export interface EventSubscriptionOptions {
    /** Higher priorities run before lower priorities. */
    readonly priority?: number;
    /** Optional owner used for diagnostics/cleanup. */
    readonly owner?: string;
}

interface EventEntry {
    readonly listener: EventListener<unknown>;
    readonly owner: string | undefined;
    readonly priority: number;
    readonly sequence: number;
}

/**
 * Small asynchronous event bus for notifications that do not need middleware
 * semantics or a return value.
 *
 * Use {@link HookRegistry} instead when a plugin must transform data,
 * short-circuit behavior, or wrap another handler.
 */
export class EventBus<TEvents extends { [K in keyof TEvents]: unknown }> {
    private readonly entries = new Map<keyof TEvents, EventEntry[]>();
    private sequence = 0;

    /** Subscribes to an event and returns a disposable unsubscriber. */
    on<K extends keyof TEvents>(
        event: K,
        listener: EventListener<TEvents[K]>,
        options: EventSubscriptionOptions = {},
    ): Disposable {
        const entry: EventEntry = {
            listener: listener as EventListener<unknown>,
            owner: options.owner,
            priority: options.priority ?? 0,
            sequence: this.sequence++,
        };

        const bucket = this.entries.get(event) ?? [];
        bucket.push(entry);
        bucket.sort((a, b) => b.priority - a.priority || a.sequence - b.sequence);
        this.entries.set(event, bucket);

        return toDisposable(() => {
            const current = this.entries.get(event);
            if (!current) {
                return;
            }

            const index = current.indexOf(entry);
            if (index >= 0) {
                current.splice(index, 1);
            }

            if (current.length === 0) {
                this.entries.delete(event);
            }
        });
    }

    /** Emits an event and waits for listeners in deterministic priority order. */
    async emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): Promise<void> {
        const listeners = [...(this.entries.get(event) ?? [])];
        for (const entry of listeners) {
            await entry.listener(payload);
        }
    }

    /** Removes every listener registered by the supplied owner. */
    removeOwner(owner: string): void {
        for (const [event, bucket] of this.entries) {
            const filtered = bucket.filter((entry) => entry.owner !== owner);
            if (filtered.length === 0) {
                this.entries.delete(event);
            } else if (filtered.length !== bucket.length) {
                this.entries.set(event, filtered);
            }
        }
    }
}
