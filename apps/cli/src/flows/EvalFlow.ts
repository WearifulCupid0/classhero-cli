import * as clack from "@clack/prompts";
import type { PluginRuntime } from "@classhero-cli/plugin-api";
import { inspect } from "node:util";
import { cleanTerminalText } from "../utils/clean.js";

/** Developer-only expression evaluator preserved from the original CLI. */
export class EvalFlow {
    constructor(private readonly runtime: PluginRuntime) {}

    async run(): Promise<void> {
        const input = await this.runtime.prompts.run({
            id: "developer.eval.code",
            kind: "text",
            message: "Código",
            validate(value) {
                return value.trim().length > 0 ? undefined : "Código inválido";
            },
        });

        if (input.status !== "submitted") {
            return;
        }

        try {
            // Intentionally local/developer-only. Never feed untrusted remote input here.
            const result = await eval(input.value);
            clack.note(cleanTerminalText(inspect(result, { depth: 2 })));
        } catch (error) {
            clack.note(cleanTerminalText(error instanceof Error ? error.stack ?? error.message : String(error)));
        }
    }
}
