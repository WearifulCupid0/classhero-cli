import type { Disposable } from "../lifecycle/Disposable.js";
import { toDisposable } from "../lifecycle/Disposable.js";
import type { MenuOption } from "./types.js";

/** Context supplied while plugins compose one menu. */
export interface MenuCompositionContext {
    readonly promptId: string;
}

/** Mutable builder used inside a menu contribution. */
export class MenuBuilder<T> {
    private options: MenuOption<T>[];

    constructor(options: readonly MenuOption<T>[]) {
        this.options = [...options];
    }

    /** Returns whether an option id currently exists. */
    has(id: string): boolean {
        return this.options.some((option) => option.id === id);
    }

    /** Appends an option. Existing ids are rejected. */
    add(option: MenuOption<T>): this {
        this.assertUnique(option.id);
        this.options.push(option);
        return this;
    }

    /** Inserts an option immediately before a known option id. */
    addBefore(targetId: string, option: MenuOption<T>): this {
        this.assertUnique(option.id);
        const index = this.requireIndex(targetId);
        this.options.splice(index, 0, option);
        return this;
    }

    /** Inserts an option immediately after a known option id. */
    addAfter(targetId: string, option: MenuOption<T>): this {
        this.assertUnique(option.id);
        const index = this.requireIndex(targetId);
        this.options.splice(index + 1, 0, option);
        return this;
    }

    /** Removes an option if present. */
    remove(id: string): this {
        this.options = this.options.filter((option) => option.id !== id);
        return this;
    }

    /** Replaces an existing option while preserving its position. */
    replace(id: string, option: MenuOption<T>): this {
        const index = this.requireIndex(id);
        if (option.id !== id) {
            this.assertUnique(option.id);
        }
        this.options.splice(index, 1, option);
        return this;
    }

    /** Updates selected fields of an option. */
    update(id: string, patch: Partial<Omit<MenuOption<T>, "id">>): this {
        const index = this.requireIndex(id);
        const current = this.options[index];
        if (!current) {
            throw new Error(`Menu option ${id} does not exist.`);
        }
        this.options[index] = { ...current, ...patch };
        return this;
    }

    /** Returns an immutable snapshot of the current option order. */
    snapshot(): readonly MenuOption<T>[] {
        return [...this.options];
    }

    private requireIndex(id: string): number {
        const index = this.options.findIndex((option) => option.id === id);
        if (index < 0) {
            throw new Error(`Menu option ${id} does not exist.`);
        }
        return index;
    }

    private assertUnique(id: string): void {
        if (this.has(id)) {
            throw new Error(`Menu option ${id} already exists.`);
        }
    }
}

/** Function that modifies a menu through {@link MenuBuilder}. */
export type MenuContribution<T> = (
    builder: MenuBuilder<T>,
    context: MenuCompositionContext,
) => void | Promise<void>;

/** Registration options for one menu contribution. */
export interface MenuContributionOptions {
    readonly priority?: number;
    readonly owner?: string;
}

interface MenuContributionEntry {
    readonly contribution: MenuContribution<unknown>;
    readonly owner: string | undefined;
    readonly priority: number;
    readonly sequence: number;
}

/**
 * Registry that lets plugins inject, remove or replace options in existing
 * select menus without importing or patching `@clack/prompts`.
 */
export class MenuRegistry {
    private readonly entries = new Map<string, MenuContributionEntry[]>();
    private sequence = 0;

    /** Registers a contribution for one stable prompt id. */
    contribute<T>(
        promptId: string,
        contribution: MenuContribution<T>,
        options: MenuContributionOptions = {},
    ): Disposable {
        const entry: MenuContributionEntry = {
            contribution: contribution as MenuContribution<unknown>,
            owner: options.owner,
            priority: options.priority ?? 0,
            sequence: this.sequence++,
        };

        const bucket = this.entries.get(promptId) ?? [];
        bucket.push(entry);
        bucket.sort((a, b) => b.priority - a.priority || a.sequence - b.sequence);
        this.entries.set(promptId, bucket);

        return toDisposable(() => {
            const current = this.entries.get(promptId);
            if (!current) {
                return;
            }
            const index = current.indexOf(entry);
            if (index >= 0) {
                current.splice(index, 1);
            }
            if (current.length === 0) {
                this.entries.delete(promptId);
            }
        });
    }

    /** Applies all registered contributions and returns the final option list. */
    async compose<T>(promptId: string, options: readonly MenuOption<T>[]): Promise<readonly MenuOption<T>[]> {
        const builder = new MenuBuilder(options);
        const context: MenuCompositionContext = { promptId };

        for (const entry of [...(this.entries.get(promptId) ?? [])]) {
            await (entry.contribution as MenuContribution<T>)(builder, context);
        }

        return builder.snapshot();
    }

    /** Removes all contributions registered by one owner. */
    removeOwner(owner: string): void {
        for (const [promptId, bucket] of this.entries) {
            const filtered = bucket.filter((entry) => entry.owner !== owner);
            if (filtered.length === 0) {
                this.entries.delete(promptId);
            } else if (filtered.length !== bucket.length) {
                this.entries.set(promptId, filtered);
            }
        }
    }
}
