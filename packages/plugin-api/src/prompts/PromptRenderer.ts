import type { AnyPromptDefinition, PromptRenderResult } from "./types.js";

/**
 * Adapter implemented by the host application to render interactive prompts.
 *
 * `packages/plugin-api` deliberately has no dependency on `@clack/prompts`.
 * `apps/cli` will implement this interface by translating the neutral prompt
 * definitions into Clack calls and translating cancellation back into a
 * {@link PromptRenderResult}.
 */
export interface PromptRenderer {
    /** Renders one already-composed prompt definition. */
    render(definition: AnyPromptDefinition): Promise<PromptRenderResult<unknown>>;
}
