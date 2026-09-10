import { createServiceToken } from "@classhero-cli/plugin-api";
import type { AIProvider } from "./contracts.js";

/**
 * Multi-provider service token used by AI provider plugins.
 *
 * More than one implementation may be registered simultaneously. The
 * automator selects a compatible provider at execution time.
 */
export const AI_PROVIDER = createServiceToken<AIProvider>(
    "classhero.ai.provider",
    "Provider-neutral language-model implementation available to the ClassHero AI Automator.",
);
