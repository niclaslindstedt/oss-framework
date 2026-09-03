// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  extSuffix,
  parsePhone,
  phoneDialString,
  toStoredPhone,
} from "../src/format/index.ts";

describe("parsePhone", () => {
  it("splits an international number into country code and national digits", () => {
    const p = parsePhone("+46 8 123 456 78");
    expect(p.countryCode).toBe("46");
    expect(p.national).toBe("812345678");
    expect(p.valid).toBe(true);
  });

  it("treats the 00 access prefix as international", () => {
    const p = parsePhone("0046 8 12 34 56");
    expect(p.countryCode).toBe("46");
    expect(p.national).toBe("8123456");
  });

  it("keeps a bare local number entirely in national", () => {
    const p = parsePhone("(555) 123-4567");
    expect(p.countryCode).toBeNull();
    expect(p.national).toBe("5551234567");
  });

  it("peels a trailing extension off the number", () => {
    const p = parsePhone("+1 202 555 0100 ext. 42");
    expect(p.countryCode).toBe("1");
    expect(p.national).toBe("2025550100");
    expect(p.ext).toBe("42");
  });

  it("reports an empty / digitless input as invalid", () => {
    expect(parsePhone("").valid).toBe(false);
    expect(parsePhone("  no digits  ").valid).toBe(false);
  });
});

describe("toStoredPhone", () => {
  it("strips separators and peels the calling code off an international number", () => {
    expect(toStoredPhone("+46 (0)70-123 45 67")).toEqual({
      value: "0701234567",
      countryCode: "46",
    });
    expect(toStoredPhone("0046 8 12 34 56")).toEqual({
      value: "8123456",
      countryCode: "46",
    });
  });

  it("keeps a bare local number as pure national digits with no code", () => {
    expect(toStoredPhone("(555) 123-4567")).toEqual({ value: "5551234567" });
    expect(toStoredPhone("08-123 45 67")).toEqual({ value: "081234567" });
  });

  it("drops a trailing extension, leaving only the national digits", () => {
    expect(toStoredPhone("+1 202 555 0100 ext. 42")).toEqual({
      value: "2025550100",
      countryCode: "1",
    });
  });

  it("yields an empty value for a digitless input", () => {
    expect(toStoredPhone("n/a")).toEqual({ value: "" });
  });
});

describe("phoneDialString", () => {
  it("re-attaches the calling code to the national digits", () => {
    expect(phoneDialString({ value: "701234567", countryCode: "46" })).toBe(
      "+46701234567",
    );
  });

  it("returns bare national digits when there is no code", () => {
    expect(phoneDialString({ value: "0812345678" })).toBe("0812345678");
  });

  it("is empty when there are no digits", () => {
    expect(phoneDialString({ value: "" })).toBe("");
  });
});

describe("extSuffix", () => {
  it("renders an extension as a readable suffix", () => {
    expect(extSuffix("42")).toBe(" ext. 42");
  });

  it("says nothing when there is no extension", () => {
    expect(extSuffix(null)).toBe("");
  });

  it("takes the app's own word for it", () => {
    expect(extSuffix("42", "anknytning")).toBe(" anknytning 42");
  });
});
