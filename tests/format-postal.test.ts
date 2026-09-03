// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  addressLines,
  formatAddress,
  hasAddress,
  mapsUrl,
  parseAddress,
} from "../src/format/index.ts";

describe("hasAddress", () => {
  it("is true when any part carries content", () => {
    expect(hasAddress({ street: "Main St 1" })).toBe(true);
    expect(hasAddress({ city: "Stockholm" })).toBe(true);
    expect(hasAddress({ zip: "12345" })).toBe(true);
  });

  it("is false when every part is blank or absent", () => {
    expect(hasAddress({})).toBe(false);
    expect(hasAddress({ street: "  ", zip: "", city: undefined })).toBe(false);
  });
});

describe("addressLines / formatAddress", () => {
  it("puts the street on its own line and joins zip + city", () => {
    const a = { street: "Main St 1", zip: "111 22", city: "Stockholm" };
    expect(addressLines(a)).toEqual(["Main St 1", "111 22 Stockholm"]);
    expect(formatAddress(a)).toBe("Main St 1, 111 22 Stockholm");
  });

  it("drops the missing parts", () => {
    expect(addressLines({ city: "Oslo" })).toEqual(["Oslo"]);
    expect(formatAddress({ street: "Elm St 9" })).toBe("Elm St 9");
    expect(formatAddress({})).toBe("");
  });
});

describe("mapsUrl", () => {
  it("builds a universal Google Maps search link with the encoded address", () => {
    const url = mapsUrl({ street: "Main St 1", zip: "111 22", city: "Sthlm" });
    expect(url).toBe(
      "https://www.google.com/maps/search/?api=1&query=" +
        encodeURIComponent("Main St 1, 111 22 Sthlm"),
    );
  });
});

describe("parseAddress", () => {
  it("splits a two-line street / zip-city address", () => {
    expect(parseAddress("Main St 1\n111 22 Stockholm")).toEqual({
      street: "Main St 1",
      zip: "111 22",
      city: "Stockholm",
    });
  });

  it("splits a comma-separated one-liner", () => {
    expect(parseAddress("Elm Street 9, 12345 Berlin")).toEqual({
      street: "Elm Street 9",
      zip: "12345",
      city: "Berlin",
    });
  });

  it("reads a zip that trails the city", () => {
    expect(parseAddress("Baker Street 221B\nLondon 20500")).toEqual({
      street: "Baker Street 221B",
      zip: "20500",
      city: "London",
    });
  });

  it("keeps a street-only value in the street slot", () => {
    expect(parseAddress("Nameless Road 4")).toEqual({
      street: "Nameless Road 4",
    });
  });

  it("treats a plain locality tail with no zip as the city", () => {
    expect(parseAddress("Main St 1, Springfield")).toEqual({
      street: "Main St 1",
      city: "Springfield",
    });
  });

  it("returns an empty address for blank input", () => {
    expect(parseAddress("   ")).toEqual({});
  });
});
