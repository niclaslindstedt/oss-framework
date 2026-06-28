// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  classifyLines,
  parseInline,
  shortenUrl,
  type InlineNode,
} from "../src/markdown/index.ts";
import {
  extractSourceRange,
  type SourcePoint,
} from "../src/markdown/markdown-selection.ts";

describe("classifyLines — block kinds", () => {
  it("classifies headings with level and content offset", () => {
    const [block] = classifyLines("## Title");
    expect(block?.kind).toBe("heading");
    expect(block?.level).toBe(2);
    expect(block?.content).toBe("Title");
    // "## " is three characters, so content begins at column 3.
    expect(block?.contentStart).toBe(3);
  });

  it("classifies unordered and ordered list items", () => {
    const ul = classifyLines("- milk")[0];
    expect(ul?.kind).toBe("ul");
    expect(ul?.content).toBe("milk");

    const ol = classifyLines("1. first")[0];
    expect(ol?.kind).toBe("ol");
    expect(ol?.ordinal).toBe("1.");
    expect(ol?.content).toBe("first");
  });

  it("classifies blank, quote, and hr lines", () => {
    expect(classifyLines("")[0]?.kind).toBe("blank");
    expect(classifyLines("> quoted")[0]?.kind).toBe("quote");
    expect(classifyLines("---")[0]?.kind).toBe("hr");
  });

  it("treats lines inside a fenced block as code, not Markdown", () => {
    const blocks = classifyLines("```\n# not a heading\n```");
    expect(blocks.map((b) => b.kind)).toEqual(["fence", "code", "fence"]);
  });

  it("yields one block per source line", () => {
    expect(classifyLines("a\nb\nc")).toHaveLength(3);
  });
});

describe("parseInline — emphasis, code, links", () => {
  it("parses bold, italic, and strikethrough", () => {
    expect(parseInline("**b**")[0]?.type).toBe("strong");
    expect(parseInline("*i*")[0]?.type).toBe("em");
    expect(parseInline("~~s~~")[0]?.type).toBe("strikethrough");
  });

  it("parses inline code with an absolute offset", () => {
    const node = parseInline("ab `code`", 0).find((n) => n.type === "code");
    expect(node).toBeTruthy();
    // The code text starts one char past the backtick at column 3 → 4.
    if (node?.type === "code") expect(node.offset).toBe(4);
  });

  it("parses an explicit markdown link", () => {
    const node = parseInline("[label](https://x.com)").find(
      (n): n is Extract<InlineNode, { type: "link" }> => n.type === "link",
    );
    expect(node?.text).toBe("label");
    expect(node?.href).toBe("https://x.com");
    expect(node?.bare).toBeUndefined();
  });

  it("autolinks a bare URL and flags it bare", () => {
    const node = parseInline("see https://x.com/a here").find(
      (n): n is Extract<InlineNode, { type: "link" }> => n.type === "link",
    );
    expect(node?.href).toBe("https://x.com/a");
    expect(node?.bare).toBe(true);
  });

  it("prefixes a www. autolink with https", () => {
    const node = parseInline("www.x.com").find(
      (n): n is Extract<InlineNode, { type: "link" }> => n.type === "link",
    );
    expect(node?.href).toBe("https://www.x.com");
  });

  it("does not open emphasis inside snake_case", () => {
    const nodes = parseInline("a_b_c");
    expect(nodes.every((n) => n.type === "text")).toBe(true);
  });

  it("carries absolute offsets so a click maps back to source", () => {
    const node = parseInline("hello world", 5).find((n) => n.type === "text");
    if (node?.type === "text") expect(node.offset).toBe(5);
  });
});

describe("shortenUrl", () => {
  it("returns short URLs unchanged", () => {
    expect(shortenUrl("https://x.com", 4)).toBe("https://x.com");
  });

  it("is a no-op when chars is 0", () => {
    const long = "https://example.com/a/very/long/path/that/keeps/going";
    expect(shortenUrl(long, 0)).toBe(long);
  });

  it("elides the middle of a long URL and never grows it", () => {
    const long = "https://example.com/a/very/long/path/that/keeps/going";
    const short = shortenUrl(long, 4);
    expect(short.length).toBeLessThan(long.length);
    expect(short).toContain("[...]");
  });
});

describe("extractSourceRange — verbatim source from a selection", () => {
  const lines = ["# Title", "- one", "- two"];
  const blocks = classifyLines(lines.join("\n"));

  it("returns the raw source between two points, clamped to content", () => {
    const a: SourcePoint = { line: 0, col: 2 }; // after "# "
    const b: SourcePoint = { line: 0, col: 7 };
    expect(extractSourceRange(lines, blocks, a, b)).toBe("Title");
  });

  it("orders the endpoints and spans multiple lines, clamping to content", () => {
    // Reversed endpoints — the function orders them itself. Each line's list
    // marker ("- ") is a non-selectable glyph, so the source slice starts at
    // the content column, never leaking the marker into the copy.
    const a: SourcePoint = { line: 2, col: 5 };
    const b: SourcePoint = { line: 1, col: 2 };
    expect(extractSourceRange(lines, blocks, a, b)).toBe("one\ntwo");
  });
});
