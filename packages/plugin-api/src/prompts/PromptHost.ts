import type { CoreHookMap } from "../hooks/types.js";
import type { HookRegistry } from "../hooks/HookRegistry.js";
import type { MenuRegistry } from "./MenuRegistry.js";
import type { PromptRenderer } from "./PromptRenderer.js";
import type {
    AnyPromptDefinition,
    ConfirmPromptDefinition,
    CustomPromptDefinition,
    MenuOption,
    MultiSelectPromptDefinition,
    PromptRenderResult,
    SelectPromptDefinition,
    TextPromptDefinition,
} from "./types.js";

/**
 * Renderer-independent prompt orchestrator used by the CLI and plugins.
 *
 * Processing order:
 * 1. `prompt:before` middleware can transform the definition.
 * 2. select/multiselect options are composed through {@link MenuRegistry}.
 * 3. `prompt:resolve` middleware may short-circuit and return a result.
 * 4. unresolved prompts are delegated to {@link PromptRenderer}.
 * 5. `prompt:after` middleware can transform the final result.
 * 6. the matching menu option `onSelect` callback is executed, when present.
 */
export class PromptHost {
    constructor(
        private readonly renderer: PromptRenderer,
        private readonly hooks: HookRegistry<CoreHookMap>,
        private readonly menus: MenuRegistry,
    ) {}

    run(definition: TextPromptDefinition): Promise<PromptRenderResult<string>>;
    run(definition: ConfirmPromptDefinition): Promise<PromptRenderResult<boolean>>;
    run<T>(definition: SelectPromptDefinition<T>): Promise<PromptRenderResult<T>>;
    run<T>(definition: MultiSelectPromptDefinition<T>): Promise<PromptRenderResult<readonly T[]>>;
    run<T>(definition: CustomPromptDefinition<T>): Promise<PromptRenderResult<T>>;
    async run(definition: AnyPromptDefinition): Promise<PromptRenderResult<unknown>> {
        const before = await this.hooks.run(
            "prompt:before",
            { definition },
            (payload) => payload.definition,
        );

        const composed = await this.composeMenus(before);

        const resolved = await this.hooks.run(
            "prompt:resolve",
            { definition: composed },
            async () => undefined,
        );

        const initialResult = resolved ?? await this.renderer.render(composed);
        const finalResult = await this.hooks.run(
            "prompt:after",
            { definition: composed, result: initialResult },
            (payload) => payload.result,
        );

        await this.executeSelectionHandlers(composed, finalResult);
        return finalResult;
    }

    private async composeMenus(definition: AnyPromptDefinition): Promise<AnyPromptDefinition> {
        if (definition.kind === "select") {
            return {
                ...definition,
                options: await this.menus.compose(definition.id, definition.options),
            };
        }

        if (definition.kind === "multiselect") {
            return {
                ...definition,
                options: await this.menus.compose(definition.id, definition.options),
            };
        }

        return definition;
    }

    private async executeSelectionHandlers(
        definition: AnyPromptDefinition,
        result: PromptRenderResult<unknown>,
    ): Promise<void> {
        if (result.status !== "submitted") {
            return;
        }

        if (definition.kind === "select") {
            const option = findOption(definition.options, result.value);
            await option?.onSelect?.(option.value);
            return;
        }

        if (definition.kind === "multiselect" && Array.isArray(result.value)) {
            for (const value of result.value) {
                const option = findOption(definition.options, value);
                await option?.onSelect?.(option.value);
            }
        }
    }
}

function findOption(
    options: readonly MenuOption<unknown>[],
    value: unknown,
): MenuOption<unknown> | undefined {
    return options.find((option) => Object.is(option.value, value));
}
