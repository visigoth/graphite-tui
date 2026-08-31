import React from "react";
import { Box, Text } from "ink";
import type { BranchCommit } from "../data/git.js";
import { colors, selectionBg } from "./theme.js";

interface Props {
  /** Branch the commits belong to, for the header. */
  branch: string;
  /** Parent the range was taken against; null when the branch has none. */
  parent: string | null;
  commits: BranchCommit[];
  selectedIndex: number;
  /** First visible row. */
  scrollOffset: number;
  /** Number of commit rows that fit. */
  visible: number;
  /** Total width available, so long subjects truncate rather than wrap. */
  width: number;
}

/** Truncate to exactly `w` columns; Ink wraps anything wider onto a new line. */
function fit(text: string, w: number): string {
  const chars = [...text];
  return chars.length > w ? chars.slice(0, Math.max(0, w - 1)).join("") + "…" : text;
}

/**
 * `git log --oneline` for one branch, as a selectable list.
 *
 * Shown when a branch has more than one commit of its own; picking a row opens
 * that commit's full message and patch. A single-commit branch skips this and
 * opens the commit directly — a one-item menu is friction, not a choice.
 */
export function CommitListOverlay({
  branch,
  parent,
  commits,
  selectedIndex,
  scrollOffset,
  visible,
  width,
}: Props) {
  const start = Math.max(
    0,
    Math.min(scrollOffset, Math.max(0, commits.length - visible))
  );
  const window = commits.slice(start, start + visible);
  const more = commits.length - (start + window.length);
  // border(2) + paddingX(2*2) + sha column + two spaces.
  const subjectWidth = Math.max(10, width - 6 - 9);

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
        <Text color={colors.dim}>
          {"  "}
          {commits.length} commit{commits.length === 1 ? "" : "s"}
          {parent ? ` since ${parent}` : " (no parent — showing recent)"}
        </Text>
      </Text>
      <Box height={1} />
      {start > 0 && <Text color={colors.dim}>↑ {start} more</Text>}
      {window.map((c, i) => {
        const idx = start + i;
        const selected = idx === selectedIndex;
        const bg = selectionBg(selected, true);
        return (
          <Text key={c.sha} backgroundColor={bg} wrap="truncate-end">
            <Text color={selected ? undefined : colors.prNumber}>
              {c.short.padEnd(8)}
            </Text>
            <Text color={selected ? undefined : colors.age}> </Text>
            {fit(c.subject, subjectWidth)}
          </Text>
        );
      })}
      {more > 0 && <Text color={colors.dim}>↓ {more} more</Text>}
      <Box height={1} />
      <Text color={colors.dim}>
        ↑/↓ or j/k move · ↵ show commit · esc/q close
      </Text>
    </Box>
  );
}
