// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  AuthError,
  backoffDelayMs,
  ConflictError,
  isRetryableSaveError,
  MAX_TRANSIENT_SAVE_RETRIES,
  OFFLINE_RESUME_MS,
  RateLimitError,
} from "../src/storage/index.ts";

describe("backoffDelayMs", () => {
  it("returns the equal-jitter window [cap/2, cap) for each attempt", () => {
    // With rand pinned to 0 the delay is exactly cap/2; pinned to ~1 it
    // approaches the cap without reaching it.
    const opts = { baseMs: 500, factor: 2, maxMs: 30_000 };
    // attempt 0: cap = 500 → [250, 500)
    expect(backoffDelayMs(0, opts, () => 0)).toBe(250);
    expect(backoffDelayMs(0, opts, () => 0.999)).toBeLessThanOrEqual(500);
    // attempt 1: cap = 1000 → [500, 1000)
    expect(backoffDelayMs(1, opts, () => 0)).toBe(500);
    // attempt 2: cap = 2000 → [1000, 2000)
    expect(backoffDelayMs(2, opts, () => 0)).toBe(1000);
  });

  it("caps the deterministic ceiling at maxMs", () => {
    const opts = { baseMs: 500, factor: 2, maxMs: 4000 };
    // attempt 10 would be 500 * 2^10 = 512000, capped to 4000 → [2000, 4000)
    expect(backoffDelayMs(10, opts, () => 0)).toBe(2000);
    const high = backoffDelayMs(10, opts, () => 0.999);
    expect(high).toBeGreaterThanOrEqual(2000);
    expect(high).toBeLessThanOrEqual(4000);
  });

  it("falls back to the default curve when no options are given", () => {
    // Defaults: baseMs 500, factor 2, maxMs 30000. attempt 0 → [250, 500).
    expect(backoffDelayMs(0, {}, () => 0)).toBe(250);
  });

  it("clamps negative / fractional attempts to a non-negative integer", () => {
    const opts = { baseMs: 500, factor: 2, maxMs: 30_000 };
    expect(backoffDelayMs(-3, opts, () => 0)).toBe(250);
    expect(backoffDelayMs(1.9, opts, () => 0)).toBe(500); // floors to attempt 1
  });

  it("always returns at least half the cap (equal jitter, not full jitter)", () => {
    const opts = { baseMs: 1000, factor: 2, maxMs: 30_000 };
    for (let i = 0; i < 50; i++) {
      const delay = backoffDelayMs(0, opts, () => i / 50);
      expect(delay).toBeGreaterThanOrEqual(500);
      expect(delay).toBeLessThanOrEqual(1000);
    }
  });
});

describe("isRetryableSaveError", () => {
  it("does not retry the three typed signals with dedicated handling", () => {
    expect(
      isRetryableSaveError(new ConflictError({ text: "", revision: "r1" })),
    ).toBe(false);
    expect(isRetryableSaveError(new AuthError("auth"))).toBe(false);
    expect(isRetryableSaveError(new RateLimitError(1000))).toBe(false);
  });

  it("retries any other error (a generic backend hiccup)", () => {
    expect(isRetryableSaveError(new Error("500"))).toBe(true);
    expect(isRetryableSaveError(new TypeError("network"))).toBe(true);
    expect(isRetryableSaveError("boom")).toBe(true);
    expect(isRetryableSaveError(undefined)).toBe(true);
  });
});

describe("policy constants", () => {
  it("exposes a bounded transient budget and an unbudgeted offline interval", () => {
    expect(MAX_TRANSIENT_SAVE_RETRIES).toBeGreaterThan(0);
    expect(OFFLINE_RESUME_MS).toBeGreaterThan(0);
  });
});
