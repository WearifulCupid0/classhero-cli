/**
 * Context received by one hook middleware.
 *
 * Calling {@link HookMiddlewareContext.next} delegates to the next middleware.
 * A middleware may instead return a result directly to short-circuit the rest
 * of the chain.
 */
export interface HookMiddlewareContext<TPayload, TResult> {
    /** Current payload after transformations performed by previous middleware. */
    readonly payload: TPayload;

    /**
     * Continues the middleware chain.
     *
     * @param payload - Optional replacement payload passed to the next handler.
     */
    next(payload?: TPayload): Promise<TResult>;
}

/** Middleware function used by {@link HookRegistry}. */
export type HookMiddleware<TPayload, TResult> = (
    context: HookMiddlewareContext<TPayload, TResult>,
) => TResult | Promise<TResult>;
