import fs from "node:fs/promises";
import type { AuthResponse } from "@classhero-cli/api-wrapper";
import { JsonFileStore } from "./JsonFileStore.js";

/** Persists authentication data and migrates the legacy root `login.json`. */
export class SessionStore {
    private readonly current: JsonFileStore<AuthResponse>;

    constructor(
        sessionPath: string,
        private readonly legacyLoginPath: string,
    ) {
        this.current = new JsonFileStore<AuthResponse>(sessionPath);
    }

    async load(): Promise<AuthResponse | undefined> {
        const current = await this.current.read();
        if (current) {
            return current;
        }

        const legacy = await this.readLegacy();
        if (!legacy) {
            return undefined;
        }

        await this.current.write(legacy);
        return legacy;
    }

    async save(auth: AuthResponse): Promise<void> {
        await this.current.write(auth);
    }

    async clear(): Promise<void> {
        await Promise.all([
            this.current.delete(),
            fs.rm(this.legacyLoginPath, { force: true }).then(() => undefined),
        ]);
    }

    private async readLegacy(): Promise<AuthResponse | undefined> {
        try {
            const raw = await fs.readFile(this.legacyLoginPath, "utf8");
            return JSON.parse(raw) as AuthResponse;
        } catch (error) {
            if (error instanceof Error
                && "code" in error
                && (error as NodeJS.ErrnoException).code === "ENOENT") {
                return undefined;
            }
            throw error;
        }
    }
}
