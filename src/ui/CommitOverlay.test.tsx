import React from "react";
import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";
import { CommitOverlay } from "./CommitOverlay.js";

const ANSI = new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g");

const strip = (frame: string) => frame.split(ANSI).join("");

const SHOW = [
  "commit 15426a1b79d38f5ede2f22d838eedcebd3e9dcf5 (commit-message-template)",
  "Author: A Dev <dev@example.test>",
  "Date:   Thu Aug 20 10:46:25 2026 -0700",
  "",
  "    chore: ship a commit message template",
  "",
  "    Body line one.",
  "    Body line two.",
].join("\n");

const draw = (props: Partial<Parameters<typeof CommitOverlay>[0]> = {}) =>
  strip(
    render(
      <CommitOverlay
        branch="commit-message-template"
        text={SHOW}
        scrollOffset={0}
        visible={20}
        {...props}
      />
    ).lastFrame() ?? ""
  );

describe("CommitOverlay", () => {
  it("shows the full message body, not just the subject", () => {
    const out = draw();
    expect(out).toContain("chore: ship a commit message template");
    expect(out).toContain("Body line one.");
    expect(out).toContain("Body line two.");
  });

  it("keeps git's ref decoration visible", () => {
    // The decoration is the only place the refs at this commit are named, so
    // it must survive into the rendered frame.
    expect(draw()).toContain("(commit-message-template)");
  });

  it("scrolls, reporting how much is hidden above and below", () => {
    const out = draw({ visible: 3, scrollOffset: 2 });
    expect(out).toContain("↑ 2 more");
    expect(out).toContain("↓ 3 more");
    expect(out).not.toContain("Body line two.");
  });

  it("clamps a scroll offset past the end instead of blanking the body", () => {
    const out = draw({ visible: 3, scrollOffset: 999 });
    expect(out).toContain("Body line two.");
    // Match the "↓ N more" indicator specifically — the footer hint also
    // contains a "↓ ".
    expect(out).not.toMatch(/↓ \d+ more/);
    expect(out).toMatch(/↑ \d+ more/);
  });

  it("says so when the commit could not be read", () => {
    const out = draw({ text: null });
    expect(out).toContain("No commit found");
  });
});
