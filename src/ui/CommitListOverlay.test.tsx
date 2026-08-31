import React from "react";
import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";
import { CommitListOverlay } from "./CommitListOverlay.js";
import type { BranchCommit } from "../data/git.js";

const ANSI = new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g");
const strip = (f: string) => f.split(ANSI).join("");

const commits = (n: number): BranchCommit[] =>
  Array.from({ length: n }, (_, i) => ({
    sha: `${i}`.padStart(40, "a"),
    short: `abc${i}`.padEnd(7, "0"),
    subject: `subject number ${i}`,
  }));

const draw = (over: Partial<Parameters<typeof CommitListOverlay>[0]> = {}) =>
  strip(
    render(
      <CommitListOverlay
        branch="feature"
        parent="develop"
        commits={commits(5)}
        selectedIndex={0}
        scrollOffset={0}
        visible={10}
        width={100}
        {...over}
      />
    ).lastFrame() ?? ""
  );

describe("CommitListOverlay", () => {
  it("lists every commit with its short sha and subject", () => {
    const out = draw();
    expect(out).toContain("subject number 0");
    expect(out).toContain("subject number 4");
    expect(out).toContain("abc0");
  });

  it("names the branch, the count and the parent it ranges against", () => {
    const out = draw();
    expect(out).toContain("feature");
    expect(out).toContain("5 commits");
    expect(out).toContain("since develop");
  });

  it("says so when the branch has no parent to range against", () => {
    const out = draw({ parent: null });
    expect(out).toContain("no parent");
  });

  it("singularises a one-commit branch", () => {
    const out = draw({ commits: commits(1) });
    expect(out).toContain("1 commit");
    expect(out).not.toContain("1 commits");
  });

  it("windows long histories and reports what is hidden", () => {
    const out = draw({ commits: commits(40), visible: 5, scrollOffset: 10 });
    expect(out).toContain("↑ 10 more");
    expect(out).toContain("↓ 25 more");
    expect(out).toContain("subject number 10");
    expect(out).not.toContain("subject number 9 ");
  });

  it("clamps a scroll offset past the end rather than blanking the list", () => {
    const out = draw({ commits: commits(40), visible: 5, scrollOffset: 999 });
    expect(out).toContain("subject number 39");
  });

  it("truncates a long subject rather than wrapping the row", () => {
    const long = commits(1);
    long[0]!.subject = "x".repeat(400);
    const lines = draw({ commits: long, width: 60 }).split("\n");
    // A wrapped subject would add rows, so compare against the same overlay
    // holding a short subject rather than hardcoding the chrome's height.
    const baseline = draw({ commits: commits(1), width: 60 }).split("\n");
    expect(lines.length).toBe(baseline.length);
    // The bordered box stretches to the terminal, so the rendered row is
    // padded out regardless; what matters is that the subject itself was cut
    // to the width the caller asked for.
    const row = lines.find((l) => l.includes("x")) ?? "";
    expect((row.match(/x/g) ?? []).length).toBeLessThanOrEqual(60 - 15);
    expect(row).toContain("…");
  });
});
