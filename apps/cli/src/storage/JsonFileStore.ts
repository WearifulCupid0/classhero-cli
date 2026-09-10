import fs from "node:fs/promises";
import path from "node:path";

/** Small atomic JSON file store used for CLI-owned state. */
export class JsonFileStore<T> {
    private pendingWrite: Promise<void> = Promise.resolve();

    constructor(readonly filePath: string) {}

    async read(): Promise<T | undefined> {
        await this.pendingWrite;

        try {
            const content = await fs.readFile(this.filePath, "utf8");
            return JSON.parse(content) as T;
        } catch (error) {
            if (isNotFound(error)) {
                return undefined;
            }
            throw error;
        }
    }

    async write(value: T): Promise<void> {
        this.pendingWrite = this.pendingWrite.then(() => this.writeAtomic(value));
        return this.pendingWrite;
    }

    async delete(): Promise<boolean> {
        await this.pendingWrite;

        try {
            await fs.unlink(this.filePath);
            return true;
        } catch (error) {
            if (isNotFound(error)) {
                return false;
            }
            throw error;
        }
    }

    private async writeAtomic(value: T): Promise<void> {
        const directory = path.dirname(this.filePath);
        const temporary = `${this.filePath}.${process.pid}.tmp`;

        await fs.mkdir(directory, { recursive: true });
        await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");

        await fs.rm(this.filePath, { force: true }).catch(() => undefined);
        await fs.rename(temporary, this.filePath);
    }
}

function isNotFound(error: unknown): boolean {
    return error instanceof Error
        && "code" in error
        && (error as NodeJS.ErrnoException).code === "ENOENT";
}
