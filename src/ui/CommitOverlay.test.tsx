import React from "react";
import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";
import { CommitOverlay, classifyLine } from "./CommitOverlay.js";

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

  it("renders a multi-file patch, not just the message", () => {
    // The file viewer's unified-diff parser is single-file: it drops
    // everything before the first @@, so the second file's header would be
    // swallowed. This overlay colours line by line precisely to avoid that.
    const patch = [
      "commit abc123 (HEAD -> feature)",
      "Author: A Dev <dev@example.test>",
      "",
      "    feat: two files",
      "",
      "diff --git a/one.ts b/one.ts",
      "index 111..222 100644",
      "--- a/one.ts",
      "+++ b/one.ts",
      "@@ -1,2 +1,2 @@",
      "-const a = 0;",
      "+const a = 1;",
      "diff --git a/two.ts b/two.ts",
      "--- a/two.ts",
      "+++ b/two.ts",
      "@@ -5,3 +5,3 @@ fn main()",
      "+added in the second file",
    ].join("\n");
    const out = draw({ text: patch, visible: 40 });
    expect(out).toContain("feat: two files");
    expect(out).toContain("diff --git a/two.ts");
    expect(out).toContain("added in the second file");
    expect(out).toContain("@@ -5,3 +5,3 @@");
  });

  it("says so when the commit could not be read", () => {
    const out = draw({ text: null });
    expect(out).toContain("No commit found");
  });
});

describe("classifyLine", () => {
  it("distinguishes patch metadata from additions and deletions", () => {
    // `---` and `+++` start with - and + but are file headers, not changes.
    // Getting this backwards paints every file header red and green.
    expect(classifyLine("--- a/src/foo.ts")).toBe("meta");
    expect(classifyLine("+++ b/src/foo.ts")).toBe("meta");
    expect(classifyLine("diff --git a/x b/x")).toBe("meta");
    expect(classifyLine("index 1234567..89abcde 100644")).toBe("meta");
    expect(classifyLine("new file mode 100644")).toBe("meta");
    expect(classifyLine("Binary files a/x and b/x differ")).toBe("meta");
  });

  it("classifies real additions and deletions", () => {
    expect(classifyLine("+  const x = 1;")).toBe("add");
    expect(classifyLine("-  const x = 0;")).toBe("del");
    expect(classifyLine("+")).toBe("add");
  });

  it("classifies the header block and hunk markers", () => {
    expect(classifyLine("commit abc123 (HEAD -> feature)")).toBe("commit");
    expect(classifyLine("Author: A Dev <dev@example.test>")).toBe("header");
    expect(classifyLine("Date:   Thu Aug 20 10:46:25 2026 -0700")).toBe("header");
    expect(classifyLine("Merge: abc123 def456")).toBe("header");
    expect(classifyLine("@@ -1,4 +1,6 @@ fn main()")).toBe("hunk");
  });

  it("treats message text and context lines as body", () => {
    expect(classifyLine("    chore: ship a template")).toBe("body");
    expect(classifyLine(" unchanged line")).toBe("body");
    expect(classifyLine("")).toBe("body");
  });
});
