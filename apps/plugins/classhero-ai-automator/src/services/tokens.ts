import { createServiceToken } from "@classhero-cli/plugin-api";
import type { AutomationEngine } from "../engine/AutomationEngine.js";

/**
 * Service published by the automator while enabled.
 *
 * Other plugins may inspect or trigger automation without importing concrete
 * implementation classes from the plugin lifecycle module.
 */
export const AUTOMATION_ENGINE = createServiceToken<AutomationEngine>(
    "classhero.automation.engine",
    "ClassHero activity automation engine.",
);
