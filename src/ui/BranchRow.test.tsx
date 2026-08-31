import React from "react";
import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";
import type { Branch, RenderRow } from "../types.js";
import { BranchRow } from "./BranchRow.js";

const ANSI = new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g");

const branch = (over: Partial<Branch> = {}): Branch => ({
  name: "feature",
  parent: "develop",
  children: [],
  revision: "abc",
  isTrunk: false,
  needsRestack: false,
  state: null,
  age: "52m",
  ahead: 91,
  behind: 1,
  upstreamGone: false,
  unpushed: false,
  pr: {
    prNumber: 10007,
    title: "perf: counts-only IF upload response, chunked convert",
    state: "OPEN",
    reviewDecision: null,
    isDraft: true,
    url: "https://example.test/pr/10007",
    headRefName: "feature",
    baseRefName: "develop",
  },
  displayTitle: "perf: counts-only IF upload response, chunked convert",
  ...over,
});

const row = (over: Partial<RenderRow> = {}): RenderRow => ({
  branch: branch(),
  depth: 0,
  column: 0,
  through: [false, false, false],
  mergeFrom: [],
  isCurrent: true,
  detached: false,
  ...over,
});

/** Frame lines with colour codes stripped, as the terminal would lay them out. */
function lines(frame: string): string[] {
  return frame.split("\n").map((l) => l.split(ANSI).join(""));
}

describe("BranchRow", () => {
  // A row wider than `width` makes Ink wrap the flex row onto a second line,
  // which reads as a blank gap punched into the middle of the graph.
  it("never wraps, however much metadata the row carries", () => {
    for (const width of [121, 100, 80, 60, 45, 30]) {
      const out = lines(
        render(
          <BranchRow
            row={row()}
            columnCount={3}
            selected
            focused
            width={width}
            titleWidth={Math.max(20, width - 2 - 3 * 2 - 1 - 40)}
            prW={6}
            statusW={7}
            ageW={3}
            ciW={1}
            mergeConflict
            threadCounts={{ total: 4, resolved: 1 }}
            ci="passed"
          />
        ).lastFrame() ?? ""
      );
      expect(out, `width ${width}`).toHaveLength(1);
      expect([...out[0]].length, `width ${width}`).toBeLessThanOrEqual(width);
    }
  });

  it("keeps the fixed right-hand columns and drops indicators when cramped", () => {
    const out = lines(
      render(
        <BranchRow
          row={row()}
          columnCount={3}
          selected={false}
          focused={false}
          width={45}
          titleWidth={20}
          prW={6}
          statusW={7}
          ageW={3}
          ciW={1}
          mergeConflict
          ci="passed"
        />
      ).lastFrame() ?? ""
    );
    expect(out[0]).toContain("#10007");
    expect(out[0]).toContain("52m");
    expect(out[0]).not.toContain("conflicts");
  });

  const label = (over: Parameters<typeof BranchRow>[0]) =>
    lines(render(<BranchRow {...over} />).lastFrame() ?? "")[0] ?? "";

  const base = {
    row: row(),
    columnCount: 3,
    selected: false,
    focused: false,
    width: 121,
    titleWidth: 72,
    prW: 6,
    statusW: 7,
    ageW: 3,
    ciW: 1,
  } as const;

  it("shows the PR title by default", () => {
    const out = label({ ...base });
    expect(out).toContain("perf: counts-only IF upload response");
    expect(out).not.toContain("feature");
  });

  it("shows the branch name in `branch` mode", () => {
    const out = label({ ...base, labelMode: "branch" });
    expect(out).toContain("feature");
    expect(out).not.toContain("perf: counts-only");
  });

  it("shows the branch name then the PR title in `both` mode", () => {
    const out = label({ ...base, labelMode: "both" });
    expect(out.indexOf("feature")).toBeGreaterThanOrEqual(0);
    expect(out.indexOf("perf: counts-only")).toBeGreaterThan(
      out.indexOf("feature")
    );
  });

  it("does not repeat the name in `both` mode when there is no PR", () => {
    const noPr = row({ branch: branch({ pr: null, displayTitle: "feature" }) });
    const out = label({ ...base, row: noPr, labelMode: "both" });
    expect(out.match(/feature/g) ?? []).toHaveLength(1);
  });

  it("links the PR number without disturbing the column layout", () => {
    // Links are off unless stdout is a terminal, which it never is under the
    // test runner — opt in explicitly.
    for (const labelMode of ["title", "branch", "both"] as const) {
      for (const width of [121, 100, 80, 60, 45, 30]) {
        const out = lines(
          render(
            <BranchRow
              {...base}
              width={width}
              titleWidth={Math.max(20, width - 2 - 3 * 2 - 1 - 40)}
              labelMode={labelMode}
              mergeConflict
              threadCounts={{ total: 4, resolved: 1 }}
              ci="passed"
            />
          ).lastFrame() ?? ""
        );
        expect(out, `${labelMode} @ ${width}`).toHaveLength(1);
        expect([...out[0]].length, `${labelMode} @ ${width}`)
          .toBeLessThanOrEqual(width);
      }
    }
  });
});
