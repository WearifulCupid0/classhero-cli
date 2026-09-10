import { JsonFileStore } from "../storage/JsonFileStore.js";

/** One configured external/built-in plugin module. */
export interface PluginConfigEntry {
    readonly specifier: string;
    readonly enabled: boolean;
}

/** Persistent plugin configuration schema. */
export interface PluginConfigFile {
    readonly version: 1;
    readonly plugins: readonly PluginConfigEntry[];
}

const EMPTY_CONFIG: PluginConfigFile = {
    version: 1,
    plugins: [],
};

/** Owns the persistent list of plugin module specifiers and enable state. */
export class PluginConfigStore {
    private readonly store: JsonFileStore<PluginConfigFile>;

    constructor(filePath: string) {
        this.store = new JsonFileStore<PluginConfigFile>(filePath);
    }

    async load(): Promise<PluginConfigFile> {
        const config = await this.store.read();
        if (!config) {
            return EMPTY_CONFIG;
        }

        if (config.version !== 1 || !Array.isArray(config.plugins)) {
            throw new Error("Formato inválido em plugins.json.");
        }

        return {
            version: 1,
            plugins: config.plugins
                .filter((entry) => typeof entry.specifier === "string" && entry.specifier.trim().length > 0)
                .map((entry) => ({ specifier: entry.specifier.trim(), enabled: Boolean(entry.enabled) })),
        };
    }

    async upsert(entry: PluginConfigEntry): Promise<void> {
        const config = await this.load();
        const without = config.plugins.filter((item) => item.specifier !== entry.specifier);
        await this.store.write({
            version: 1,
            plugins: [...without, entry],
        });
    }

    async setEnabled(specifier: string, enabled: boolean): Promise<void> {
        await this.upsert({ specifier, enabled });
    }

    async remove(specifier: string): Promise<void> {
        const config = await this.load();
        await this.store.write({
            version: 1,
            plugins: config.plugins.filter((entry) => entry.specifier !== specifier),
        });
    }
}
