/**
 * Key/value storage scoped to one plugin.
 *
 * The plugin API does not perform filesystem I/O itself. The CLI may provide
 * a persistent implementation while tests can use {@link MemoryPluginStorage}.
 */
export interface PluginStorage {
    /** Reads a value, returning `undefined` when the key does not exist. */
    get<T>(key: string): Promise<T | undefined>;

    /** Stores a JSON-compatible or otherwise host-supported value. */
    set<T>(key: string, value: T): Promise<void>;

    /** Removes one key. */
    delete(key: string): Promise<boolean>;

    /** Returns whether the key currently exists. */
    has(key: string): Promise<boolean>;

    /** Lists all keys visible to the plugin. */
    keys(): Promise<readonly string[]>;

    /** Removes all values owned by the plugin. */
    clear(): Promise<void>;
}

/** Factory that creates storage already scoped to the supplied plugin id. */
export type PluginStorageFactory = (pluginId: string) => PluginStorage;

/** In-memory storage implementation useful as a fallback and in tests. */
export class MemoryPluginStorage implements PluginStorage {
    private readonly values = new Map<string, unknown>();

    async get<T>(key: string): Promise<T | undefined> {
        return this.values.get(key) as T | undefined;
    }

    async set<T>(key: string, value: T): Promise<void> {
        this.values.set(key, value);
    }

    async delete(key: string): Promise<boolean> {
        return this.values.delete(key);
    }

    async has(key: string): Promise<boolean> {
        return this.values.has(key);
    }

    async keys(): Promise<readonly string[]> {
        return [...this.values.keys()];
    }

    async clear(): Promise<void> {
        this.values.clear();
    }
}
