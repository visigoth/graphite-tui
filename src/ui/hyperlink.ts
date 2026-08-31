/**
 * OSC 8 terminal hyperlinks.
 *
 * `ESC ] 8 ;; <url> BEL <text> ESC ] 8 ;; BEL` makes `text` clickable in
 * terminals that support it. The BEL (`\u0007`) terminator is used rather than
 * ST (`ESC \`) because it is the form `strip-ansi`'s pattern — and therefore
 * Ink's own width measurement — reliably recognizes.
 */

const OPEN = "\u001B]8;;";
const BEL = "\u0007";

/** Matches a complete OSC 8 open or close sequence. */
const OSC8 = /\u001B\]8;;[^\u0007]*\u0007/g;

/**
 * `text` with hyperlink escapes removed. They occupy zero terminal columns, so
 * anything doing its own column math must measure through this.
 */
export function stripLinks(text: string): string {
  return text.replace(OSC8, "");
}

// Module-level so callers read it the same way they read the active palette.
// Resolved once at startup by `applyHyperlinks`.
let enabled = false;

/**
 * Decide whether to emit hyperlinks. Off unless stdout is a terminal: piping
 * the TUI into a file or a pager should yield plain text, not escape soup.
 *
 * `GRAPHITE_TUI_LINKS=0` (or `--no-links`) forces them off for terminals that
 * render the escape as literal garbage rather than ignoring it; `=1` forces
 * them on when the detection is wrong.
 */
export function applyHyperlinks(argv: string[] = []): void {
  const env = process.env.GRAPHITE_TUI_LINKS?.trim();
  if (argv.includes("--no-links") || env === "0") {
    enabled = false;
    return;
  }
  if (env === "1") {
    enabled = true;
    return;
  }
  enabled = Boolean(process.stdout.isTTY) && process.env.TERM !== "dumb";
}

export function hyperlinksEnabled(): boolean {
  return enabled;
}

/**
 * Wrap `text` so it links to `url`. Returns `text` unchanged when hyperlinks
 * are disabled or the URL is unknown, so callers never branch on support.
 *
 * Pad *before* linking: the padding then sits inside the clickable region and
 * the column math, which runs on the padded string, is unaffected.
 */
export function link(text: string, url: string | null): string {
  if (!enabled || !url) return text;
  return `${OPEN}${url}${BEL}${text}${OPEN}${BEL}`;
}
