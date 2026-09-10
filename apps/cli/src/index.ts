#!/usr/bin/env node

import { CLI } from "./CLI.js";

const cli = new CLI();

cli.start().catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
});
