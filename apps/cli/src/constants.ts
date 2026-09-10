import figlet from "figlet";

/** Banner displayed when the interactive CLI starts. */
export const BANNER = `\n${figlet.textSync("ClassHero CLI", {
    horizontalLayout: "default",
    font: "Standard",
    verticalLayout: "fitted",
})}`;

/** Environment variable that overrides the CLI state directory. */
export const CLI_HOME_ENV = "CLASSHERO_CLI_HOME";

/** Enables the local developer eval flow when set to `1`. */
export const CLI_ENABLE_EVAL_ENV = "CLASSHERO_CLI_ENABLE_EVAL";
