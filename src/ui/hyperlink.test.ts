import { describe, expect, it, beforeEach } from "vitest";
import { applyHyperlinks, hyperlinksEnabled, link, stripLinks } from "./hyperlink.js";

const ESC = "\u001B";
const BEL = "\u0007";

describe("hyperlink", () => {
  beforeEach(() => {
    delete process.env.GRAPHITE_TUI_LINKS;
  });

  it("wraps text in an OSC 8 sequence when enabled", () => {
    process.env.GRAPHITE_TUI_LINKS = "1";
    applyHyperlinks();
    expect(link("#1193", "https://example.test/1193")).toBe(
      `${ESC}]8;;https://example.test/1193${BEL}#1193${ESC}]8;;${BEL}`
    );
  });

  it("returns the text untouched when disabled", () => {
    process.env.GRAPHITE_TUI_LINKS = "0";
    applyHyperlinks();
    expect(link("#1193", "https://example.test/1193")).toBe("#1193");
  });

  it("returns the text untouched when the url is unknown", () => {
    process.env.GRAPHITE_TUI_LINKS = "1";
    applyHyperlinks();
    expect(link("#1193", null)).toBe("#1193");
  });

  it("honours --no-links over an enabling env var", () => {
    process.env.GRAPHITE_TUI_LINKS = "1";
    applyHyperlinks(["--no-links"]);
    expect(hyperlinksEnabled()).toBe(false);
  });

  it("strips the escapes back out, leaving the visible text", () => {
    process.env.GRAPHITE_TUI_LINKS = "1";
    applyHyperlinks();
    const linked = link("  #1193", "https://example.test/1193");
    expect(stripLinks(linked)).toBe("  #1193");
    // The whole point: a link must not change how wide the cell renders.
    expect(stripLinks(linked)).toHaveLength("  #1193".length);
  });

  it("strips a url containing characters that look like a terminator", () => {
    process.env.GRAPHITE_TUI_LINKS = "1";
    applyHyperlinks();
    const linked = link("x", "https://example.test/a?b=1&c=%5D8;;d");
    expect(stripLinks(linked)).toBe("x");
  });
});
