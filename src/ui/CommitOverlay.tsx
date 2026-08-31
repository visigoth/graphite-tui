import React from "react";
import { Box, Text } from "ink";
import { colors } from "./theme.js";

interface Props {
  /** Branch whose tip commit is shown, for the header. */
  branch: string;
  /** `git show -s` output; null when the commit could not be read. */
  text: string | null;
  /** First visible line index. */
  scrollOffset: number;
  /** Number of body lines that fit on screen. */
  visible: number;
}

/**
 * The `commit <sha> (HEAD -> branch, origin/branch)` line. It carries the ref
 * decorations, so it stays bright while the rest of the preamble is dimmed.
 */
const COMMIT_LINE = /^commit\b/;
/** The remaining `git show -s` preamble, above the blank line and body. */
const HEADER = /^(Author|AuthorDate|Commit|CommitDate|Date|Merge)\b/;

/**
 * Full-screen, scrollable view of a branch tip's complete commit message.
 *
 * The branch list only ever shows a one-line label — a PR title or a branch
 * name — so the commit's own body (the rationale, the testing notes, the
 * trailers) is otherwise unreachable without leaving the TUI.
 */
export function CommitOverlay({ branch, text, scrollOffset, visible }: Props) {
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
              // Dim the Author/Date preamble so the message body is what the
              // eye lands on; the `commit` line keeps full contrast because
              // its ref decorations name the branches at this commit.
              color={
                COMMIT_LINE.test(line)
                  ? colors.current
                  : HEADER.test(line)
                    ? colors.dim
                    : undefined
              }
            >
              {line || " "}
            </Text>
          ))}
          {more > 0 && <Text color={colors.dim}>↓ {more} more</Text>}
        </>
      )}
      <Box height={1} />
      <Text color={colors.dim}>
        ↑/↓ or j/k scroll · space page · esc/q close
      </Text>
    </Box>
  );
}
