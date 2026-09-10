import * as clack from "@clack/prompts";
import type {
    AnyPromptDefinition,
    MenuOption,
    PromptRenderResult,
    PromptRenderer,
} from "@classhero-cli/plugin-api";
import { cancelled, submitted } from "@classhero-cli/plugin-api";

/** Bridges renderer-neutral plugin API prompts to `@clack/prompts`. */
export class ClackPromptRenderer implements PromptRenderer {
    async render(definition: AnyPromptDefinition): Promise<PromptRenderResult<unknown>> {
        switch (definition.kind) {
            case "text": {
                const result = definition.secret
                    ? await clack.password({
                        message: definition.message,
                        ...(definition.validate === undefined ? {} : {
                            validate: (value: string | undefined) => definition.validate?.(value ?? ""),
                        }),
                    })
                    : await clack.text({
                        message: definition.message,
                        ...(definition.placeholder === undefined ? {} : { placeholder: definition.placeholder }),
                        ...(definition.initialValue === undefined ? {} : { initialValue: definition.initialValue }),
                        ...(definition.validate === undefined ? {} : {
                            validate: (value: string | undefined) => definition.validate?.(value ?? ""),
                        }),
                    });

                return toRenderResult(result);
            }

            case "confirm": {
                const result = await clack.confirm({
                    message: definition.message,
                    ...(definition.initialValue === undefined ? {} : { initialValue: definition.initialValue }),
                    ...(definition.activeLabel === undefined ? {} : { active: definition.activeLabel }),
                    ...(definition.inactiveLabel === undefined ? {} : { inactive: definition.inactiveLabel }),
                });
                return toRenderResult(result);
            }

            case "select": {
                if (definition.options.length === 0) {
                    clack.cancel("Nenhuma opção disponível.");
                    return cancelled("empty-options");
                }

                const options = definition.options.map(toClackOption);
                const result = definition.searchable
                    ? await clack.autocomplete({
                        message: definition.message,
                        options,
                        ...(definition.initialValue === undefined ? {} : { initialValue: definition.initialValue }),
                    })
                    : await clack.select({
                        message: definition.message,
                        options,
                        ...(definition.initialValue === undefined ? {} : { initialValue: definition.initialValue }),
                    });

                return toRenderResult(result);
            }

            case "multiselect": {
                if (definition.options.length === 0) {
                    clack.cancel("Nenhuma opção disponível.");
                    return cancelled("empty-options");
                }

                const result = await clack.multiselect({
                    message: definition.message,
                    options: definition.options.map(toClackOption),
                    ...(definition.initialValues === undefined ? {} : { initialValues: [...definition.initialValues] }),
                    ...(definition.required === undefined ? {} : { required: definition.required }),
                });
                return toRenderResult(result);
            }

            case "custom":
                throw new Error(`Renderer customizado não suportado pelo host: ${definition.renderer}`);
        }
    }
}

function toClackOption(option: MenuOption<unknown>) {
    const disabledReason = typeof option.disabled === "string" ? option.disabled : undefined;
    const hint = [option.hint, disabledReason].filter((value): value is string => Boolean(value)).join(" · ");

    return {
        label: option.label,
        value: option.value,
        ...(hint.length === 0 ? {} : { hint }),
        ...(option.disabled === undefined ? {} : { disabled: Boolean(option.disabled) }),
    };
}

function toRenderResult(value: unknown): PromptRenderResult<unknown> {
    if (clack.isCancel(value)) {
        return cancelled("user-cancelled");
    }

    return submitted(value);
}
