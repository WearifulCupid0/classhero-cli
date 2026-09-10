import path from "node:path";
import type { PluginStorage, PluginStorageFactory } from "@classhero-cli/plugin-api";
import { JsonFileStore } from "./JsonFileStore.js";

/** JSON-backed implementation of the plugin-scoped storage contract. */
export class FilePluginStorage implements PluginStorage {
    private readonly store: JsonFileStore<Record<string, unknown>>;
    private pendingMutation: Promise<void> = Promise.resolve();

    constructor(filePath: string) {
        this.store = new JsonFileStore<Record<string, unknown>>(filePath);
    }

    async get<T>(key: string): Promise<T | undefined> {
        await this.pendingMutation;
        const values = await this.store.read() ?? {};
        return values[key] as T | undefined;
    }

    async set<T>(key: string, value: T): Promise<void> {
        return this.mutate(async (values) => ({ ...values, [key]: value }));
    }

    async delete(key: string): Promise<boolean> {
        await this.pendingMutation;
        const values = await this.store.read() ?? {};
        if (!(key in values)) {
            return false;
        }

        await this.mutate(async (current) => {
            const next = { ...current };
            delete next[key];
            return next;
        });
        return true;
    }

    async has(key: string): Promise<boolean> {
        await this.pendingMutation;
        const values = await this.store.read() ?? {};
        return key in values;
    }

    async keys(): Promise<readonly string[]> {
        await this.pendingMutation;
        return Object.keys(await this.store.read() ?? {});
    }

    async clear(): Promise<void> {
        this.pendingMutation = this.pendingMutation.then(async () => {
            await this.store.delete();
        });
        return this.pendingMutation;
    }

    private async mutate(
        update: (current: Record<string, unknown>) => Promise<Record<string, unknown>>,
    ): Promise<void> {
        this.pendingMutation = this.pendingMutation.then(async () => {
            const current = await this.store.read() ?? {};
            await this.store.write(await update(current));
        });
        return this.pendingMutation;
    }
}

/** Creates plugin storage files isolated by encoded plugin id. */
export function createFilePluginStorageFactory(directory: string): PluginStorageFactory {
    return (pluginId: string) => new FilePluginStorage(
        path.join(directory, `${encodeURIComponent(pluginId)}.json`),
    );
}
