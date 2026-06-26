// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import { fromBase64Url, toBase64Url } from "../src/storage/base64url.ts";
import {
  bearerAuthHeader,
  parseRetryAfterMs,
  requestLabel,
} from "../src/storage/http-utils.ts";
import { pickOauthProvider } from "../src/storage/oauth-pkce.ts";
import { dropboxApiArg } from "../src/storage/dropbox/index.ts";

describe("base64url", () => {
  it("round-trips arbitrary bytes URL-safely", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    const encoded = toBase64Url(bytes);
    expect(encoded).not.toMatch(/[+/=]/);
    expect([...fromBase64Url(encoded)]).toEqual([...bytes]);
  });
});

describe("http-utils", () => {
  it("builds a bearer header", () => {
    expect(bearerAuthHeader("tok")).toEqual({ Authorization: "Bearer tok" });
  });

  it("labels a request as host + path only (no token / query)", () => {
    expect(requestLabel("https://api.example.com/v2/x?secret=1")).toBe(
      "api.example.com/v2/x",
    );
  });

  it("parses Retry-After seconds into ms, clamped to the floor", () => {
    const h = new Headers({ "Retry-After": "2" });
    expect(parseRetryAfterMs(h, 5000)).toBe(5000); // floor wins
    expect(parseRetryAfterMs(new Headers({ "Retry-After": "10" }), 5000)).toBe(
      10000,
    );
    expect(parseRetryAfterMs(undefined, 1234)).toBe(1234);
  });
});

describe("pickOauthProvider", () => {
  const pending = (gdrive: boolean, dropbox: boolean) => [
    { id: "gdrive" as const, isPending: gdrive },
    { id: "dropbox" as const, isPending: dropbox },
  ];

  it("picks the only live flow regardless of state", () => {
    expect(
      pickOauthProvider({ state: null, pending: pending(true, false) }),
    ).toBe("gdrive");
    expect(
      pickOauthProvider({ state: null, pending: pending(false, true) }),
    ).toBe("dropbox");
  });

  it("disambiguates two live flows by state, else null", () => {
    expect(
      pickOauthProvider({ state: "dropbox", pending: pending(true, true) }),
    ).toBe("dropbox");
    expect(
      pickOauthProvider({ state: null, pending: pending(true, true) }),
    ).toBeNull();
  });

  it("returns null when nothing is pending", () => {
    expect(
      pickOauthProvider({ state: "gdrive", pending: pending(false, false) }),
    ).toBeNull();
  });
});

describe("dropboxApiArg", () => {
  it("ASCII-escapes characters above U+007F so fetch accepts the header", () => {
    const arg = dropboxApiArg({ path: "/café/π.md" });
    expect(arg).not.toMatch(/[\u0080-\uffff]/);
    // Round-trips back to the original once a JSON parser decodes the escapes.
    expect(JSON.parse(arg)).toEqual({ path: "/café/π.md" });
  });
});
