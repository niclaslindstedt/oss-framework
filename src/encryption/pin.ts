// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A PIN: a short code asked for before something opens on this device.
//
// **What this is for, and what it is not.** A PIN is a *soft* lock: it stops a
// borrowed phone, a curious sibling or a shoulder-surfer from opening the
// thing behind it, and it is cheap enough to type every time. It is not
// encryption and must never be sold as it:
//
//   - a code short enough to type on a phone has a small keyspace, so anyone
//     who can read the stored verifier can walk the keyspace offline;
//   - and whatever the PIN gates is still readable by anyone who reaches the
//     bytes without going through the gate.
//
// Encryption (`encryptText`, `withEncryption`) is the real protection for
// bytes that leave the device; a PIN is the convenience layer on top, and the
// copy an app puts beside one should say so.
//
// What is stored is a PBKDF2-SHA256 verifier — a random salt, the derived bits
// and the iteration count — never the code. Verification compares in constant
// time so a guess's correct prefix can't be learned by timing the check.

import { fromBase64, toBase64 } from "./crypto.ts";

/** The shortest code accepted. Longer is meaningfully better — see above. */
export const PIN_MIN_LENGTH = 4;

// OWASP 2023 password-storage guidance, matching the envelope's KDF cost. It
// buys real time against an offline attack on a *long* code; on a four-digit
// one it buys much less, which is why the copy has to be honest about it.
const PIN_ITERATIONS = 600_000;
const PIN_SALT_BYTES = 16;
const PIN_BITS = 256;

/** The stored verifier for a PIN. Never contains the code. */
export type PinVerifier = {
  /** Base64 random salt, fresh per PIN. */
  salt: string;
  /** Base64 PBKDF2-SHA256 output over the code and salt. */
  hash: string;
  /** KDF cost, stored so an old verifier keeps verifying after a bump. */
  iterations: number;
};

/** Whether `value` is a well-formed {@link PinVerifier} (e.g. read back from storage). */
export function isPinVerifier(value: unknown): value is PinVerifier {
  if (typeof value !== "object" || value === null) return false;
  const pin = value as PinVerifier;
  return (
    typeof pin.salt === "string" &&
    pin.salt.length > 0 &&
    typeof pin.hash === "string" &&
    pin.hash.length > 0 &&
    typeof pin.iterations === "number" &&
    Number.isFinite(pin.iterations) &&
    pin.iterations > 0
  );
}

async function deriveBits(
  code: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(code) as BufferSource,
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    key,
    PIN_BITS,
  );
  return new Uint8Array(bits);
}

/** Mint a verifier for a code. Throws on a code shorter than {@link PIN_MIN_LENGTH}. */
export async function createPinVerifier(code: string): Promise<PinVerifier> {
  if (code.length < PIN_MIN_LENGTH) {
    throw new Error(`A PIN needs at least ${PIN_MIN_LENGTH} characters`);
  }
  const salt = new Uint8Array(PIN_SALT_BYTES);
  crypto.getRandomValues(salt);
  const hash = await deriveBits(code, salt, PIN_ITERATIONS);
  return {
    salt: toBase64(salt),
    hash: toBase64(hash),
    iterations: PIN_ITERATIONS,
  };
}

/**
 * Whether a code matches a stored verifier. Compares in constant time: a
 * byte-by-byte early return would leak how much of a guess was right to
 * anyone who can time the call, which on a short code is most of the work.
 */
export async function verifyPin(
  code: string,
  stored: PinVerifier,
): Promise<boolean> {
  let expected: Uint8Array;
  let salt: Uint8Array;
  try {
    expected = fromBase64(stored.hash);
    salt = fromBase64(stored.salt);
  } catch {
    return false;
  }
  const actual = await deriveBits(code, salt, stored.iterations);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i += 1) {
    diff |= (actual[i] as number) ^ (expected[i] as number);
  }
  return diff === 0;
}
