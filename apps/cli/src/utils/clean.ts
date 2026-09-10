/** Escapes characters that may be interpreted specially by terminal renderers. */
export function cleanTerminalText(value: string): string {
    const zeroWidthSpace = String.fromCharCode(8203);
    return value
        .replace(/`/g, `\`${zeroWidthSpace}`)
        .replace(/@/g, `@${zeroWidthSpace}`);
}
