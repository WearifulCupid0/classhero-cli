/**
 * Represents a resource that can be released by the plugin runtime.
 *
 * Hooks, menu contributions, services and event subscriptions all return a
 * `Disposable`. Plugin authors normally do not need to call `dispose()`
 * manually because resources registered through a {@link PluginContext} are
 * automatically attached to the current lifecycle scope.
 */
export interface Disposable {
    /** Releases the resource. Calling this method more than once must be safe. */
    dispose(): void | Promise<void>;
}

/** A callback accepted by {@link toDisposable}. */
export type DisposeCallback = () => void | Promise<void>;

/**
 * Creates an idempotent {@link Disposable} from a callback.
 *
 * @param callback - Cleanup logic executed at most once.
 */
export function toDisposable(callback: DisposeCallback): Disposable {
    let disposed = false;

    return {
        async dispose(): Promise<void> {
            if (disposed) {
                return;
            }

            disposed = true;
            await callback();
        },
    };
}

/**
 * LIFO collection of disposable resources.
 *
 * The stack is used internally by {@link PluginManager} so resources created
 * during `enable()` disappear automatically when the plugin is disabled.
 */
export class DisposableStack implements Disposable {
    private readonly resources: Disposable[] = [];
    private disposed = false;

    /** Returns whether the stack has already been disposed. */
    get isDisposed(): boolean {
        return this.disposed;
    }

    /**
     * Adds a resource to the stack.
     *
     * If the stack is already disposed, the supplied resource is disposed
     * immediately instead of being retained.
     */
    add<T extends Disposable>(resource: T): T {
        if (this.disposed) {
            void resource.dispose();
            return resource;
        }

        this.resources.push(resource);
        return resource;
    }

    /** Adds a cleanup callback and returns the generated disposable. */
    defer(callback: DisposeCallback): Disposable {
        return this.add(toDisposable(callback));
    }

    /**
     * Releases every resource in reverse registration order.
     *
     * All resources are given an opportunity to dispose. If one or more
     * cleanups fail, an `AggregateError` is thrown after the stack is empty.
     */
    async dispose(): Promise<void> {
        if (this.disposed) {
            return;
        }

        this.disposed = true;
        const errors: unknown[] = [];

        while (this.resources.length > 0) {
            const resource = this.resources.pop();
            if (!resource) {
                continue;
            }

            try {
                await resource.dispose();
            } catch (error) {
                errors.push(error);
            }
        }

        if (errors.length > 0) {
            throw new AggregateError(errors, "One or more plugin resources failed to dispose.");
        }
    }
}
