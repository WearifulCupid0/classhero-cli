import path from "node:path";
import { CLI_HOME_ENV } from "../constants.js";

/** Filesystem locations used by one CLI process. */
export interface CliPaths {
    readonly root: string;
    readonly session: string;
    readonly pluginConfig: string;
    readonly pluginStorage: string;
    readonly legacyLogin: string;
}

/** Resolves persistent paths without performing filesystem I/O. */
export function resolveCliPaths(cwd = process.cwd(), env = process.env): CliPaths {
    const configured = env[CLI_HOME_ENV]?.trim();
    const root = configured
        ? path.resolve(cwd, configured)
        : path.resolve(cwd, ".classhero-cli");

    return {
        root,
        session: path.join(root, "session.json"),
        pluginConfig: path.join(root, "plugins.json"),
        pluginStorage: path.join(root, "plugins"),
        legacyLogin: path.resolve(cwd, "login.json"),
    };
}
