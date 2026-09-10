import type { Disposable } from "../lifecycle/Disposable.js";
import { toDisposable } from "../lifecycle/Disposable.js";

/**
 * Opaque, typed identifier for a service published by one plugin and consumed
 * by another.
 *
 * @typeParam T - Service contract represented by this token.
 */
export interface ServiceToken<T> {
    /** Stable identifier used for diagnostics and registry lookup. */
    readonly id: string;
    /** Optional human-readable description. */
    readonly description?: string;
    /** Type-only marker. It is never read at runtime. */
    readonly __serviceType?: T;
}

/** Creates a strongly typed service token. */
export function createServiceToken<T>(id: string, description?: string): ServiceToken<T> {
    if (!id.trim()) {
        throw new Error("Service token id cannot be empty.");
    }

    return description === undefined ? { id } : { id, description };
}

/** Options controlling one service registration. */
export interface ServiceRegistrationOptions {
    /** Plugin or host component that owns the service. */
    readonly owner: string;
    /** Higher priorities are returned before lower priorities. Defaults to `0`. */
    readonly priority?: number;
}

interface ServiceEntry {
    readonly tokenId: string;
    readonly owner: string;
    readonly priority: number;
    readonly sequence: number;
    readonly value: unknown;
}

/**
 * Registry used for dependency inversion between plugins.
 *
 * A provider plugin can register an implementation under a shared
 * {@link ServiceToken}, while the consumer depends only on the token contract.
 */
export class ServiceRegistry {
    private readonly entries = new Map<string, ServiceEntry[]>();
    private sequence = 0;

    /** Registers one service implementation and returns a disposable handle. */
    provide<T>(token: ServiceToken<T>, value: T, options: ServiceRegistrationOptions): Disposable {
        const entry: ServiceEntry = {
            tokenId: token.id,
            owner: options.owner,
            priority: options.priority ?? 0,
            sequence: this.sequence++,
            value,
        };

        const bucket = this.entries.get(token.id) ?? [];
        bucket.push(entry);
        bucket.sort((a, b) => b.priority - a.priority || a.sequence - b.sequence);
        this.entries.set(token.id, bucket);

        return toDisposable(() => {
            const current = this.entries.get(token.id);
            if (!current) {
                return;
            }

            const index = current.indexOf(entry);
            if (index >= 0) {
                current.splice(index, 1);
            }

            if (current.length === 0) {
                this.entries.delete(token.id);
            }
        });
    }

    /** Returns the highest-priority implementation, or `undefined` if absent. */
    get<T>(token: ServiceToken<T>): T | undefined {
        return this.entries.get(token.id)?.[0]?.value as T | undefined;
    }

    /** Returns every implementation ordered by registration priority. */
    getAll<T>(token: ServiceToken<T>): readonly T[] {
        return (this.entries.get(token.id) ?? []).map((entry) => entry.value as T);
    }

    /** Returns whether at least one implementation is registered. */
    has<T>(token: ServiceToken<T>): boolean {
        return (this.entries.get(token.id)?.length ?? 0) > 0;
    }

    /** Removes every service owned by the supplied plugin/component id. */
    removeOwner(owner: string): void {
        for (const [tokenId, bucket] of this.entries) {
            const filtered = bucket.filter((entry) => entry.owner !== owner);
            if (filtered.length === 0) {
                this.entries.delete(tokenId);
            } else if (filtered.length !== bucket.length) {
                this.entries.set(tokenId, filtered);
            }
        }
    }
}
