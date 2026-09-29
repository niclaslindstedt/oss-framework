// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  WrongPasswordError,
  forgetSealKeys,
  isSealedBytes,
  openBytes,
  sealBytes,
} from "../src/encryption/index.ts";

// Few rounds: the tests prove the format, not the cost.
const fast = { iterations: 1000 };

describe("sealBytes / openBytes", () => {
  it("round-trips bytes under a passphrase", async () => {
    const plain = new Uint8Array([0, 1, 2, 255, 254, 7]);
    const sealed = await sealBytes(plain, "correct horse", fast);
    expect(isSealedBytes(sealed)).toBe(true);
    expect(sealed.length).toBeGreaterThan(plain.length + 30);
    expect(Array.from(await openBytes(sealed, "correct horse"))).toEqual(
      Array.from(plain),
    );
  });

  it("writes a different ciphertext each time, from one salt per process", async () => {
    const plain = new Uint8Array(64);
    const a = await sealBytes(plain, "pw", fast);
    const b = await sealBytes(plain, "pw", fast);
    expect(Array.from(a)).not.toEqual(Array.from(b));
    // Same salt (bytes 9..25), different IV.
    expect(Array.from(a.subarray(9, 25))).toEqual(
      Array.from(b.subarray(9, 25)),
    );
    expect(Array.from(a.subarray(25, 37))).not.toEqual(
      Array.from(b.subarray(25, 37)),
    );
  });

  it("refuses the wrong passphrase, and tampered bytes", async () => {
    const sealed = await sealBytes(new Uint8Array([1, 2, 3]), "right", fast);
    await expect(openBytes(sealed, "wrong")).rejects.toBeInstanceOf(
      WrongPasswordError,
    );
    const tampered = sealed.slice();
    const last = tampered.length - 1;
    tampered[last] = (tampered[last] ?? 0) ^ 1;
    await expect(openBytes(tampered, "right")).rejects.toBeInstanceOf(
      WrongPasswordError,
    );
  });

  it("refuses what it did not write, and an empty passphrase", async () => {
    expect(isSealedBytes(new Uint8Array([1, 2, 3]))).toBe(false);
    await expect(openBytes(new Uint8Array(50), "pw")).rejects.toThrow(
      "Not sealed bytes",
    );
    await expect(sealBytes(new Uint8Array(1), "", fast)).rejects.toThrow(
      "Password is required",
    );
  });

  it("still opens after the derived keys are forgotten", async () => {
    const sealed = await sealBytes(new Uint8Array([9]), "pw", fast);
    forgetSealKeys();
    expect(Array.from(await openBytes(sealed, "pw"))).toEqual([9]);
  });

  it("handles an empty file and an offset view", async () => {
    const sealed = await sealBytes(new Uint8Array(0), "pw", fast);
    expect(Array.from(await openBytes(sealed, "pw"))).toEqual([]);
    const padded = new Uint8Array(sealed.length + 3);
    padded.set(sealed, 3);
    expect(Array.from(await openBytes(padded.subarray(3), "pw"))).toEqual([]);
  });
});
