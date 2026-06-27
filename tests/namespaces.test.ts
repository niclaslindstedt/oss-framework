// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  DEFAULT_NAMESPACE,
  DEFAULT_NAMESPACE_SLUG,
  addNamespace,
  applyFaviconHref,
  hasLocalOnlyNamespaces,
  isNamespace,
  mergeNamespaceLists,
  namespaceFaviconHref,
  normalizeNamespaces,
  parseNamespaces,
  removeNamespace,
  renameNamespace,
  serializeNamespaces,
  setNamespaceAppearance,
  slugify,
  type Namespace,
} from "../src/namespaces/index.ts";

describe("isNamespace", () => {
  it("accepts a minimal namespace and rejects malformed entries", () => {
    expect(isNamespace({ slug: "a", name: "A" })).toBe(true);
    expect(
      isNamespace({ slug: "a", name: "A", glyph: "list", color: "#f00" }),
    ).toBe(true);
    expect(isNamespace({ slug: "", name: "A" })).toBe(false);
    expect(isNamespace({ slug: "a" })).toBe(false);
    expect(isNamespace({ slug: "a", name: "A", glyph: 1 })).toBe(false);
    expect(isNamespace(null)).toBe(false);
    expect(isNamespace("x")).toBe(false);
  });
});

describe("normalizeNamespaces", () => {
  it("materialises the default at the front when absent", () => {
    const list = normalizeNamespaces([{ slug: "work", name: "Work" }]);
    expect(list[0]).toEqual(DEFAULT_NAMESPACE);
    expect(list.map((n) => n.slug)).toEqual([DEFAULT_NAMESPACE_SLUG, "work"]);
  });

  it("preserves a custom display name given to the default", () => {
    const list = normalizeNamespaces([
      { slug: "default", name: "Personal" },
      { slug: "work", name: "Work" },
    ]);
    expect(list[0]).toEqual({ slug: "default", name: "Personal" });
  });

  it("dedupes by slug (first seen wins) and drops corrupt entries", () => {
    const list = normalizeNamespaces([
      { slug: "work", name: "Work" },
      { slug: "work", name: "Duplicate" },
      { slug: "", name: "bad" },
      42,
    ]);
    expect(list.map((n) => n.name)).toEqual(["Default", "Work"]);
  });

  it("yields just the default for a non-array", () => {
    expect(normalizeNamespaces(null)).toEqual([DEFAULT_NAMESPACE]);
  });
});

describe("parse / serialize round-trip", () => {
  it("survives a serialize → parse cycle", () => {
    const list: Namespace[] = [
      DEFAULT_NAMESPACE,
      { slug: "work", name: "Work", glyph: "briefcase", color: "#3b82f6" },
    ];
    expect(parseNamespaces(serializeNamespaces(list))).toEqual(list);
  });

  it("falls back to the default on null or corrupt JSON", () => {
    expect(parseNamespaces(null)).toEqual([DEFAULT_NAMESPACE]);
    expect(parseNamespaces("{not json")).toEqual([DEFAULT_NAMESPACE]);
  });
});

describe("slugify", () => {
  it("lowercases, hyphenates, trims, and caps length", () => {
    expect(slugify("  My Work Space!! ")).toBe("my-work-space");
    expect(slugify("Åäö")).toBe("");
    expect(slugify("a".repeat(80)).length).toBe(48);
    expect(slugify("a".repeat(80), 10).length).toBe(10);
  });
});

describe("addNamespace", () => {
  it("allocates a unique slug and returns the created namespace", () => {
    const { list, created } = addNamespace([DEFAULT_NAMESPACE], "Work");
    expect(created).toEqual({ slug: "work", name: "Work" });
    expect(list.map((n) => n.slug)).toEqual([DEFAULT_NAMESPACE_SLUG, "work"]);
  });

  it("disambiguates a slug collision with a numeric suffix", () => {
    let list = [DEFAULT_NAMESPACE];
    list = addNamespace(list, "Work").list;
    const { created } = addNamespace(list, "Work");
    expect(created.slug).toBe("work-2");
  });

  it("falls back to a base slug when the name has no usable characters", () => {
    const { created } = addNamespace([DEFAULT_NAMESPACE], "!!!");
    expect(created.slug).toBe("namespace");
  });

  it("throws on an empty name and does not mutate the input", () => {
    const input = [DEFAULT_NAMESPACE];
    expect(() => addNamespace(input, "  ")).toThrow(/required/);
    expect(input).toEqual([DEFAULT_NAMESPACE]);
  });
});

describe("renameNamespace", () => {
  it("changes only the display name", () => {
    const list = renameNamespace(
      [DEFAULT_NAMESPACE, { slug: "work", name: "Work" }],
      "work",
      "Office",
    );
    expect(list[1]).toEqual({ slug: "work", name: "Office" });
  });

  it("ignores a blank name", () => {
    const input = [DEFAULT_NAMESPACE, { slug: "work", name: "Work" }];
    expect(renameNamespace(input, "work", "  ")).toEqual(input);
  });
});

describe("setNamespaceAppearance", () => {
  const list: Namespace[] = [DEFAULT_NAMESPACE, { slug: "work", name: "Work" }];

  it("sets a glyph and colour, then clears them with null", () => {
    const set = setNamespaceAppearance(list, "work", {
      glyph: "briefcase",
      color: "#f00",
    });
    expect(set[1]).toEqual({
      slug: "work",
      name: "Work",
      glyph: "briefcase",
      color: "#f00",
    });
    const cleared = setNamespaceAppearance(set, "work", {
      glyph: null,
      color: null,
    });
    expect(cleared[1]).toEqual({ slug: "work", name: "Work" });
  });

  it("leaves an omitted field untouched", () => {
    const set = setNamespaceAppearance(list, "work", { glyph: "star" });
    const recolored = setNamespaceAppearance(set, "work", { color: "#0f0" });
    expect(recolored[1]).toEqual({
      slug: "work",
      name: "Work",
      glyph: "star",
      color: "#0f0",
    });
  });
});

describe("removeNamespace", () => {
  it("removes a custom namespace but never the default", () => {
    const list: Namespace[] = [
      DEFAULT_NAMESPACE,
      { slug: "work", name: "Work" },
    ];
    expect(removeNamespace(list, "work").map((n) => n.slug)).toEqual([
      DEFAULT_NAMESPACE_SLUG,
    ]);
    expect(removeNamespace(list, DEFAULT_NAMESPACE_SLUG)).toEqual(list);
  });
});

describe("mergeNamespaceLists / hasLocalOnlyNamespaces", () => {
  const local: Namespace[] = [
    DEFAULT_NAMESPACE,
    { slug: "work", name: "Work (local)" },
    { slug: "private", name: "Private" },
  ];
  const remote: Namespace[] = [
    DEFAULT_NAMESPACE,
    { slug: "work", name: "Work (shared)", glyph: "briefcase" },
    { slug: "team", name: "Team" },
  ];

  it("lets the remote win shared slugs and carries local-only over", () => {
    const merged = mergeNamespaceLists(local, remote);
    const work = merged.find((n) => n.slug === "work");
    expect(work).toEqual({
      slug: "work",
      name: "Work (shared)",
      glyph: "briefcase",
    });
    expect(merged.map((n) => n.slug).sort()).toEqual([
      "default",
      "private",
      "team",
      "work",
    ]);
  });

  it("detects local-only namespaces", () => {
    expect(hasLocalOnlyNamespaces(local, remote)).toBe(true);
    expect(hasLocalOnlyNamespaces(remote, [...remote])).toBe(false);
  });
});

describe("namespaceFaviconHref", () => {
  const fallback = "/favicon.svg";

  it("returns the fallback when there is no namespace or no glyph", () => {
    expect(namespaceFaviconHref(undefined, fallback)).toBe(fallback);
    expect(namespaceFaviconHref({ slug: "a", name: "A" }, fallback)).toBe(
      fallback,
    );
    expect(
      namespaceFaviconHref({ slug: "a", name: "A", color: "#f00" }, fallback),
    ).toBe(fallback);
  });

  it("renders a data URI for a namespace with a valid glyph", () => {
    const href = namespaceFaviconHref(
      { slug: "a", name: "A", glyph: "briefcase", color: "#ff0000" },
      fallback,
    );
    expect(href.startsWith("data:image/svg+xml,")).toBe(true);
    expect(decodeURIComponent(href)).toContain("#ff0000");
  });

  it("tints an uncoloured glyph with defaultColor", () => {
    const href = namespaceFaviconHref(
      { slug: "a", name: "A", glyph: "briefcase" },
      fallback,
      { defaultColor: "#123456" },
    );
    expect(decodeURIComponent(href)).toContain("#123456");
  });

  it("ignores an unknown glyph name and uses the fallback", () => {
    expect(
      namespaceFaviconHref({ slug: "a", name: "A", glyph: "nope" }, fallback),
    ).toBe(fallback);
  });
});

describe("applyFaviconHref", () => {
  it("reuses an existing icon link and updates its href", () => {
    document.head.innerHTML =
      '<link rel="icon" type="image/svg+xml" href="/old.svg" />';
    applyFaviconHref("/new.svg");
    const links = document.head.querySelectorAll(
      'link[rel="icon"][type="image/svg+xml"]',
    );
    expect(links.length).toBe(1);
    expect(links[0]?.getAttribute("href")).toBe("/new.svg");
  });

  it("creates an icon link when none exists", () => {
    document.head.innerHTML = "";
    applyFaviconHref("/made.svg");
    const link = document.head.querySelector<HTMLLinkElement>(
      'link[rel="icon"][type="image/svg+xml"]',
    );
    expect(link?.getAttribute("href")).toBe("/made.svg");
  });
});
