import { describe, expect, it } from "vitest";
import {
  applyDiscoveredPrs,
  changedFilesKey,
  type DiscoveredPrs,
  focusAbove,
  focusBelow,
  nextFocus,
  normalHint,
  prNumbersOf,
  samePrStatus,
  sameRepoData,
  sameWorkingFiles,
  undiscoveredPrKey,
  worktreeHint,
} from "./appLogic.js";
import type {
  Branch,
  PrInfo,
  PrLiveStatus,
  RepoData,
} from "../types.js";
import type { WorkingFile } from "../data/status.js";

function b(partial: Partial<Branch> & { name: string }): Branch {
  return {
    parent: null,
    children: [],
    revision: null,
    isTrunk: false,
    needsRestack: false,
    state: null,
    age: "",
    ahead: 0,
    behind: 0,
    upstreamGone: false,
    unpushed: false,
    pr: null,
    displayTitle: partial.name,
    ...partial,
  };
}

function pr(prNumber: number): PrInfo {
  return {
    prNumber,
    title: "t",
    state: "OPEN",
    reviewDecision: null,
    isDraft: false,
    url: "u",
    headRefName: "h",
    baseRefName: "b",
  };
}

function repo(branches: Branch[]): RepoData {
  return {
    repoRoot: "/repo",
    trunk: "develop",
    branches: new Map(branches.map((x) => [x.name, x])),
    currentBranch: null,
    rebase: null,
    lastFetchedPrInfoMs: null,
  };
}

describe("normalHint", () => {
  it("returns the full hint list for a non-trunk branch", () => {
    const keys = normalHint(false).map(([k]) => k);
    expect(keys).toContain("d");
    expect(keys).toContain("o");
    expect(keys).toContain("S");
  });

  it("drops branch-only actions (o/g/r/S/d) when trunk is selected", () => {
    const keys = normalHint(true).map(([k]) => k);
    for (const omitted of ["o", "g", "r", "S", "d"]) {
      expect(keys).not.toContain(omitted);
    }
    // shared actions remain
    expect(keys).toContain("↵");
    expect(keys).toContain("s");
    expect(keys).toContain("/");
  });

  it("leads with T track when a detached branch is selected", () => {
    const keys = normalHint(false, true).map(([k]) => k);
    expect(keys[0]).toBe("T");
    expect(keys).toContain("S"); // still the full list beyond the lead
  });

  it("omits T track for a normal (non-detached) branch", () => {
    expect(normalHint(false).map(([k]) => k)).not.toContain("T");
  });
});

describe("worktreeHint", () => {
  it("offers only stage/unstage/discard when nothing is staged", () => {
    const keys = worktreeHint(false, false).map(([k]) => k);
    expect(keys).not.toContain("c");
    expect(keys).not.toContain("m");
    expect(keys).toEqual(["↵", "a/A", "u/U", "x/X", "Tab", "?"]);
  });

  it("offers create-branch on trunk once something is staged", () => {
    const hint = worktreeHint(true, true);
    expect(hint).toContainEqual(["c", "create branch"]);
    expect(hint.map(([k]) => k)).not.toContain("m");
  });

  it("offers amend and commit off trunk once something is staged", () => {
    const hint = worktreeHint(false, true);
    expect(hint).toContainEqual(["m", "amend"]);
    expect(hint).toContainEqual(["c", "commit"]);
    expect(hint).not.toContainEqual(["c", "create branch"]);
  });
});

describe("nextFocus", () => {
  const all = { worktree: true, files: true, logs: true };

  it("cycles branches → worktree → files → logs → branches when all are shown", () => {
    expect(nextFocus("branches", all)).toBe("worktree");
    expect(nextFocus("worktree", all)).toBe("files");
    expect(nextFocus("files", all)).toBe("logs");
    expect(nextFocus("logs", all)).toBe("branches");
  });

  it("skips panels that aren't shown", () => {
    // only branches visible -> always lands back on branches
    const none = { worktree: false, files: false, logs: false };
    expect(nextFocus("branches", none)).toBe("branches");
    // worktree hidden -> branches jumps straight to files
    expect(nextFocus("branches", { worktree: false, files: true, logs: false })).toBe(
      "files"
    );
    // files hidden -> worktree jumps to logs
    expect(nextFocus("worktree", { worktree: true, files: false, logs: true })).toBe(
      "logs"
    );
  });

  it("wraps around past hidden trailing panels back to branches", () => {
    expect(nextFocus("files", { worktree: true, files: true, logs: false })).toBe(
      "branches"
    );
  });
});

describe("focusBelow", () => {
  const all = { worktree: true, files: true, logs: true };

  it("walks down the on-screen order without wrapping", () => {
    expect(focusBelow("branches", all)).toBe("worktree");
    expect(focusBelow("worktree", all)).toBe("files");
    expect(focusBelow("files", all)).toBe("logs");
    // logs is the bottom-most panel -> nothing below it
    expect(focusBelow("logs", all)).toBeNull();
  });

  it("skips hidden panels", () => {
    expect(focusBelow("branches", { worktree: false, files: true, logs: false })).toBe(
      "files"
    );
    expect(focusBelow("branches", { worktree: false, files: false, logs: true })).toBe(
      "logs"
    );
  });

  it("returns null when no visible panel is below", () => {
    const none = { worktree: false, files: false, logs: false };
    expect(focusBelow("branches", none)).toBeNull();
    expect(focusBelow("files", { worktree: true, files: true, logs: false })).toBeNull();
  });
});

describe("focusAbove", () => {
  const all = { worktree: true, files: true, logs: true };

  it("walks up the on-screen order without wrapping", () => {
    expect(focusAbove("logs", all)).toBe("files");
    expect(focusAbove("files", all)).toBe("worktree");
    expect(focusAbove("worktree", all)).toBe("branches");
    // branches is the top-most panel -> nothing above it
    expect(focusAbove("branches", all)).toBeNull();
  });

  it("skips hidden panels", () => {
    expect(focusAbove("logs", { worktree: false, files: false, logs: true })).toBe(
      "branches"
    );
    expect(focusAbove("files", { worktree: false, files: true, logs: false })).toBe(
      "branches"
    );
  });
});

describe("changedFilesKey", () => {
  it("combines the branch name, its revision, and its parent's tip revision", () => {
    const parent = b({ name: "p", revision: "PARENT" });
    const child = b({ name: "c", revision: "CHILD", parent: "p" });
    const branches = new Map([
      ["p", parent],
      ["c", child],
    ]);
    expect(changedFilesKey(child, branches)).toBe("c@CHILD~PARENT");
  });

  it("uses an empty parent revision when the branch has no parent", () => {
    const root = b({ name: "develop", revision: "ROOT" });
    expect(changedFilesKey(root, new Map([["develop", root]]))).toBe("develop@ROOT~");
  });

  it("changes when the parent's tip moves, so the diff is refetched", () => {
    const child = b({ name: "c", revision: "CHILD", parent: "p" });
    const before = changedFilesKey(
      child,
      new Map([["p", b({ name: "p", revision: "OLD" })]])
    );
    const after = changedFilesKey(
      child,
      new Map([["p", b({ name: "p", revision: "NEW" })]])
    );
    expect(before).not.toBe(after);
  });
});

describe("prNumbersOf", () => {
  it("collects PR numbers only for branches that have a PR", () => {
    const r = repo([
      b({ name: "a", pr: pr(10) }),
      b({ name: "b" }),
      b({ name: "c", pr: pr(20) }),
    ]);
    expect(prNumbersOf(r).sort((x, y) => x - y)).toEqual([10, 20]);
  });

  it("returns an empty array when no branch has a PR", () => {
    expect(prNumbersOf(repo([b({ name: "a" })]))).toEqual([]);
  });
});

describe("applyDiscoveredPrs", () => {
  const discovered = (entries: [string, PrInfo | null][]): DiscoveredPrs =>
    new Map(entries);

  it("fills a branch that has no PR and sets its display title", () => {
    const r = repo([b({ name: "a" })]);
    applyDiscoveredPrs(r, discovered([["a", { ...pr(42), title: "My PR" }]]));
    const a = r.branches.get("a")!;
    expect(a.pr?.prNumber).toBe(42);
    expect(a.displayTitle).toBe("My PR");
  });

  it("never overwrites a PR already present from gt's cache", () => {
    const r = repo([b({ name: "a", pr: pr(1), displayTitle: "cached" })]);
    applyDiscoveredPrs(r, discovered([["a", pr(99)]]));
    const a = r.branches.get("a")!;
    expect(a.pr?.prNumber).toBe(1);
    expect(a.displayTitle).toBe("cached");
  });

  it("skips null entries (branches queried with no PR found)", () => {
    const r = repo([b({ name: "a" })]);
    applyDiscoveredPrs(r, discovered([["a", null]]));
    expect(r.branches.get("a")!.pr).toBeNull();
  });

  it("ignores discovered entries for branches not in the model", () => {
    const r = repo([b({ name: "a" })]);
    applyDiscoveredPrs(r, discovered([["ghost", pr(7)]]));
    expect(r.branches.has("ghost")).toBe(false);
  });
});

describe("undiscoveredPrKey", () => {
  it("lists non-trunk, PR-less, not-yet-queried branches, sorted", () => {
    const branches = [
      b({ name: "develop", isTrunk: true }),
      b({ name: "c" }),
      b({ name: "a" }),
      b({ name: "withpr", pr: pr(1) }),
    ];
    expect(undiscoveredPrKey(branches, new Set())).toBe("a\nc");
  });

  it("excludes branches already queried", () => {
    expect(
      undiscoveredPrKey([b({ name: "a" }), b({ name: "b" })], new Set(["a"]))
    ).toBe("b");
  });

  it("is empty when every branch is trunk, has a PR, or was queried", () => {
    const branches = [
      b({ name: "develop", isTrunk: true }),
      b({ name: "withpr", pr: pr(1) }),
      b({ name: "done" }),
    ];
    expect(undiscoveredPrKey(branches, new Set(["done"]))).toBe("");
  });

  it("treats a DiscoveredPrs map as the queried set (found or null both count)", () => {
    const queried: DiscoveredPrs = new Map([
      ["found", pr(5)],
      ["nopr", null],
    ]);
    const branches = [b({ name: "found" }), b({ name: "nopr" }), b({ name: "fresh" })];
    expect(undiscoveredPrKey(branches, queried)).toBe("fresh");
  });
});

function wf(partial: Partial<WorkingFile> & { path: string }): WorkingFile {
  return {
    index: "M",
    worktree: " ",
    staged: true,
    unstaged: false,
    untracked: false,
    additions: 1,
    deletions: 0,
    ...partial,
  };
}

function live(partial: Partial<PrLiveStatus> = {}): PrLiveStatus {
  return {
    threads: { total: 2, resolved: 1 },
    ci: "passed",
    mergeable: "mergeable",
    state: "OPEN",
    reviewDecision: null,
    ...partial,
  };
}

describe("sameRepoData", () => {
  it("treats two independently built but identical models as equal", () => {
    const a = repo([b({ name: "trunk", isTrunk: true }), b({ name: "x", parent: "trunk", pr: pr(7) })]);
    const z = repo([b({ name: "trunk", isTrunk: true }), b({ name: "x", parent: "trunk", pr: pr(7) })]);
    expect(a).not.toBe(z);
    expect(sameRepoData(a, z)).toBe(true);
  });

  it("notices a changed branch revision", () => {
    const a = repo([b({ name: "x", revision: "aaa" })]);
    const z = repo([b({ name: "x", revision: "bbb" })]);
    expect(sameRepoData(a, z)).toBe(false);
  });

  it("notices a changed PR field", () => {
    const a = repo([b({ name: "x", pr: pr(7) })]);
    const z = repo([b({ name: "x", pr: { ...pr(7), state: "MERGED" } })]);
    expect(sameRepoData(a, z)).toBe(false);
  });

  it("notices a branch gaining or losing a PR", () => {
    const a = repo([b({ name: "x" })]);
    const z = repo([b({ name: "x", pr: pr(7) })]);
    expect(sameRepoData(a, z)).toBe(false);
  });

  it("notices added, removed, and renamed branches", () => {
    const one = repo([b({ name: "x" })]);
    expect(sameRepoData(one, repo([b({ name: "x" }), b({ name: "y" })]))).toBe(false);
    expect(sameRepoData(one, repo([b({ name: "y" })]))).toBe(false);
  });

  it("notices top-level changes: current branch, trunk, and fetch time", () => {
    const base = repo([b({ name: "x" })]);
    expect(sameRepoData(base, { ...base, currentBranch: "x" })).toBe(false);
    expect(sameRepoData(base, { ...base, trunk: "main" })).toBe(false);
    expect(sameRepoData(base, { ...base, lastFetchedPrInfoMs: 1 })).toBe(false);
  });

  it("notices a rebase starting, moving, and finishing", () => {
    const clean = repo([b({ name: "x" })]);
    const stuck = { ...clean, rebase: { branch: "x", files: ["a"] } };
    expect(sameRepoData(clean, stuck)).toBe(false);
    expect(sameRepoData(stuck, { ...clean, rebase: { branch: "x", files: ["a"] } })).toBe(true);
    expect(sameRepoData(stuck, { ...clean, rebase: { branch: "x", files: ["a", "b"] } })).toBe(false);
    expect(sameRepoData(stuck, { ...clean, rebase: { branch: "y", files: ["a"] } })).toBe(false);
  });

  it("notices a changed child list even when the parents match", () => {
    const a = repo([b({ name: "x", children: ["c1"] })]);
    const z = repo([b({ name: "x", children: ["c1", "c2"] })]);
    expect(sameRepoData(a, z)).toBe(false);
  });
});

describe("sameWorkingFiles", () => {
  it("treats identical lists from separate git runs as equal", () => {
    expect(sameWorkingFiles([wf({ path: "a" })], [wf({ path: "a" })])).toBe(true);
  });

  it("notices a different length, path, or ordering", () => {
    expect(sameWorkingFiles([wf({ path: "a" })], [])).toBe(false);
    expect(sameWorkingFiles([wf({ path: "a" })], [wf({ path: "b" })])).toBe(false);
    expect(
      sameWorkingFiles(
        [wf({ path: "a" }), wf({ path: "b" })],
        [wf({ path: "b" }), wf({ path: "a" })]
      )
    ).toBe(false);
  });

  it("notices a staged/unstaged change to the same path", () => {
    expect(
      sameWorkingFiles(
        [wf({ path: "a", staged: true, unstaged: false })],
        [wf({ path: "a", staged: false, unstaged: true })]
      )
    ).toBe(false);
  });

  it("notices changed line counts", () => {
    expect(
      sameWorkingFiles([wf({ path: "a", additions: 1 })], [wf({ path: "a", additions: 2 })])
    ).toBe(false);
  });
});

describe("samePrStatus", () => {
  it("treats identical maps from separate polls as equal", () => {
    expect(samePrStatus(new Map([[1, live()]]), new Map([[1, live()]]))).toBe(true);
  });

  it("notices a different size or PR number", () => {
    expect(samePrStatus(new Map([[1, live()]]), new Map())).toBe(false);
    expect(samePrStatus(new Map([[1, live()]]), new Map([[2, live()]]))).toBe(false);
  });

  it("notices changed CI, mergeability, state, review, and thread counts", () => {
    const base = new Map([[1, live()]]);
    const differs = (p: Partial<PrLiveStatus>) =>
      samePrStatus(base, new Map([[1, live(p)]]));
    expect(differs({ ci: "failed" })).toBe(false);
    expect(differs({ mergeable: "conflicting" })).toBe(false);
    expect(differs({ state: "MERGED" })).toBe(false);
    expect(differs({ reviewDecision: "APPROVED" })).toBe(false);
    expect(differs({ threads: { total: 2, resolved: 2 } })).toBe(false);
  });
});
