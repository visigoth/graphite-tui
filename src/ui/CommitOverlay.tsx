import React from "react";
import { Box, Text } from "ink";
import { colors } from "./theme.js";

interface Props {
  /** Branch or commit the text belongs to, for the header. */
  branch: string;
  /** `git show` output; null when the commit could not be read. */
  text: string | null;
  /** First visible line index. */
  scrollOffset: number;
  /** Number of body lines that fit on screen. */
  visible: number;
  /** True when opened from the commit list, so esc goes back rather than out. */
  fromList?: boolean;
}

/**
 * The `commit <sha> (HEAD -> branch, origin/branch)` line. It carries the ref
 * decorations, so it stays bright while the rest of the preamble is dimmed.
 */
const COMMIT_LINE = /^commit\b/;
/** The remaining `git show` preamble, above the blank line and message. */
const HEADER = /^(Author|AuthorDate|Commit|CommitDate|Date|Merge)\b/;
/** Per-file patch metadata: `diff --git`, `index`, `--- a/`, `+++ b/`, modes. */
const FILE_META =
  /^(diff --git |index |--- |\+\+\+ |old mode |new mode |new file |deleted file |similarity |rename |Binary files )/;

type LineKind = "commit" | "header" | "meta" | "hunk" | "add" | "del" | "body";

/**
 * Classify one line of `git show` output for colouring.
 *
 * Deliberately line-based rather than parsed: a commit patch spans many files,
 * and the unified-diff parser used by the file viewer is single-file (it drops
 * everything before the first `@@`, so it would mangle the second file onward).
 * Colouring by leading character handles any number of files for free.
 *
 * Order matters — `---`/`+++` are file headers, not deletions/additions, so
 * FILE_META is tested before the +/- cases.
 */
export function classifyLine(line: string): LineKind {
  if (COMMIT_LINE.test(line)) return "commit";
  if (HEADER.test(line)) return "header";
  if (FILE_META.test(line)) return "meta";
  if (line.startsWith("@@")) return "hunk";
  if (line.startsWith("+")) return "add";
  if (line.startsWith("-")) return "del";
  return "body";
}

const COLOR: Record<LineKind, string | undefined> = {
  commit: colors.current,
  header: colors.dim,
  meta: colors.dim,
  hunk: colors.prNumber,
  add: colors.commentsResolved,
  del: colors.conflict,
  body: undefined,
};

/**
 * Full-screen, scrollable view of one commit: its message and its patch,
 * equivalent to `git log -1 -p`.
 *
 * The branch list only ever shows a one-line label, so the commit's own body —
 * the rationale, the testing notes, the trailers — and what it actually
 * changed are otherwise unreachable without leaving the TUI.
 */
export function CommitOverlay({
  branch,
  text,
  scrollOffset,
  visible,
  fromList,
}: Props) {
  const lines = (text ?? "").split("\n");
  const start = Math.max(
    0,
    Math.min(scrollOffset, Math.max(0, lines.length - visible))
  );
  const window = lines.slice(start, start + visible);
  const more = lines.length - (start + window.length);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={colors.current}
      paddingX={2}
      paddingY={1}
    >
      <Text bold color={colors.current}>
        {branch}
        {text && lines.length > visible ? ` (${lines.length} lines)` : ""}
      </Text>
      <Box height={1} />
      {text === null ? (
        <Text color={colors.dim}>No commit found for this branch.</Text>
      ) : (
        <>
          {start > 0 && <Text color={colors.dim}>↑ {start} more</Text>}
          {window.map((line, i) => (
            <Text
              key={start + i}
              wrap="truncate-end"
              color={COLOR[classifyLine(line)]}
            >
              {line || " "}
            </Text>
          ))}
          {more > 0 && <Text color={colors.dim}>↓ {more} more</Text>}
        </>
      )}
      <Box height={1} />
      <Text color={colors.dim}>
        ↑/↓ or j/k scroll · space page ·{" "}
        {fromList ? "esc back · q close" : "esc/q close"}
      </Text>
    </Box>
  );
}
