// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  digitsOnly,
  displayUrl,
  formatBytes,
  groupDigits,
  groupPairsLeadingTriple,
  normalizeUrl,
} from "../src/format/index.ts";

describe("normalizeUrl", () => {
  it("prefixes a bare host with https://", () => {
    expect(normalizeUrl("example.com")).toBe("https://example.com");
    expect(normalizeUrl("  example.com/path ")).toBe(
      "https://example.com/path",
    );
  });

  it("leaves a value that already carries a scheme untouched", () => {
    expect(normalizeUrl("http://example.com")).toBe("http://example.com");
    expect(normalizeUrl("https://example.com")).toBe("https://example.com");
    expect(normalizeUrl("mailto:a@b.com")).toBe("mailto:a@b.com");
  });

  it("returns empty for a blank value", () => {
    expect(normalizeUrl("")).toBe("");
    expect(normalizeUrl("   ")).toBe("");
    expect(normalizeUrl(undefined)).toBe("");
  });
});

describe("displayUrl", () => {
  it("strips the scheme and a trailing slash", () => {
    expect(displayUrl("https://example.com/")).toBe("example.com");
    expect(displayUrl("http://example.com/path")).toBe("example.com/path");
    expect(displayUrl("example.com")).toBe("example.com");
  });

  it("returns empty for a blank value", () => {
    expect(displayUrl("")).toBe("");
    expect(displayUrl(undefined)).toBe("");
  });
});

describe("digit grouping helpers", () => {
  it("strips non-digits", () => {
    expect(digitsOnly("+46 (0)76-818 13 37")).toBe("460768181337");
    expect(digitsOnly("N/A")).toBe("");
  });

  it("groups into fixed-size chunks", () => {
    expect(groupDigits("2025550100")).toBe("202 555 010 0");
    expect(groupDigits("12345", 2, "-")).toBe("12-34-5");
  });

  it("groups pairs with a leading triple when the count is odd", () => {
    expect(groupPairsLeadingTriple("8181337")).toBe("818 13 37"); // 7 → 3 2 2
    expect(groupPairsLeadingTriple("123456")).toBe("12 34 56"); // 6 → 2 2 2
    expect(groupPairsLeadingTriple("12345")).toBe("123 45"); // 5 → 3 2
    expect(groupPairsLeadingTriple("")).toBe("");
  });
});

describe("formatBytes", () => {
  it("keeps plain bytes whole", () => {
    expect(formatBytes(0, "en-US")).toBe("0 B");
    expect(formatBytes(999, "en-US")).toBe("999 B");
  });

  it("scales in decimal (base-1000) steps", () => {
    expect(formatBytes(1_000, "en-US")).toBe("1 kB");
    expect(formatBytes(12_345, "en-US")).toBe("12 kB");
    expect(formatBytes(1_500_000, "en-US")).toBe("1.5 MB");
    expect(formatBytes(128_000_000, "en-US")).toBe("128 MB");
    expect(formatBytes(2_400_000_000, "en-US")).toBe("2.4 GB");
    expect(formatBytes(3.2e12, "en-US")).toBe("3.2 TB");
    expect(formatBytes(9e18, "en-US")).toBe("9,000 PB");
  });

  it("keeps one fraction digit only while the scaled value is below 10", () => {
    expect(formatBytes(9_950_000, "en-US")).toBe("10 MB");
    expect(formatBytes(1_040, "en-US")).toBe("1 kB");
    expect(formatBytes(1_060, "en-US")).toBe("1.1 kB");
  });

  it("localizes the number but not the unit symbol", () => {
    expect(formatBytes(1_500_000, "sv-SE")).toBe("1,5 MB");
  });

  it("handles negative and non-finite input", () => {
    expect(formatBytes(-1_500_000, "en-US")).toBe("-1.5 MB");
    expect(formatBytes(Number.NaN, "en-US")).toBe("");
    expect(formatBytes(Number.POSITIVE_INFINITY, "en-US")).toBe("");
  });

  it("accepts an undefined locale (browser default)", () => {
    expect(formatBytes(2_000)).toMatch(/^2\s?kB$/);
  });
});
