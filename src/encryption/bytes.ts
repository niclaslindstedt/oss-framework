// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Sealing bytes under a passphrase — the files beside a document, where the
// document itself goes through `encryptText`'s JSON envelope.
//
// The same recipe (PBKDF2-SHA256 to an AES-GCM key, a random IV per file),
// laid out as bytes rather than base64 in JSON, because a recording is
// megabytes and a third more of them for the encoding would be waste:
//
//   "OSSB" · version (1) · iterations (u32 BE) · salt (16) · iv (12) · ciphertext
//
// One salt is drawn per process and reused, so a burst of files costs one
// key derivation rather than one each — the derivation is the slow part on
// purpose, and it protects the passphrase, not the file. Keys are cached by
// passphrase and salt, so files sealed on another device (another salt)
// derive once too.

import { WrongPasswordError } from "./errors.ts";

const MAGIC = [0x4f, 0x53, 0x53, 0x42]; // "OSSB"
const VERSION = 1;
const DEFAULT_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const HEADER_BYTES = MAGIC.length + 1 + 4 + SALT_BYTES + IV_BYTES;

const keys = new Map<string, Promise<CryptoKey>>();
let processSalt: Uint8Array<ArrayBuffer> | null = null;

function saltKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
): string {
  let s = "";
  for (const b of salt) s += String.fromCharCode(b);
  return `${iterations}\0${btoa(s)}\0${passphrase}`;
}

function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const cacheKey = saltKey(passphrase, salt, iterations);
  let pending = keys.get(cacheKey);
  if (!pending) {
    pending = (async () => {
      const raw = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(passphrase) as BufferSource,
        { name: "PBKDF2" },
        false,
        ["deriveKey"],
      );
      return crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          salt: salt as BufferSource,
          iterations,
          hash: "SHA-256",
        },
        raw,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
      );
    })();
    // A bounded cache: a device that meets many salts keeps the recent ones.
    if (keys.size >= 32) keys.delete(keys.keys().next().value as string);
    keys.set(cacheKey, pending);
    pending.catch(() => keys.delete(cacheKey));
  }
  return pending;
}

/** Whether `bytes` were written by `sealBytes`. Cheap: a header check. */
export function isSealedBytes(bytes: Uint8Array): boolean {
  if (bytes.length < HEADER_BYTES) return false;
  return (
    MAGIC.every((b, i) => bytes[i] === b) && bytes[MAGIC.length] === VERSION
  );
}

export type SealOptions = {
  /** PBKDF2 rounds. The default follows `encryptText`'s. */
  iterations?: number;
};

/** Seal `bytes` under `passphrase`. Throws if the passphrase is empty. */
export async function sealBytes(
  bytes: Uint8Array,
  passphrase: string,
  options: SealOptions = {},
): Promise<Uint8Array> {
  if (!passphrase) throw new Error("Password is required");
  const iterations = options.iterations ?? DEFAULT_ITERATIONS;
  if (!processSalt) {
    processSalt = new Uint8Array(SALT_BYTES);
    crypto.getRandomValues(processSalt);
  }
  const salt = processSalt;
  const iv = new Uint8Array(IV_BYTES);
  crypto.getRandomValues(iv);
  const key = await deriveKey(passphrase, salt, iterations);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      bytes as BufferSource,
    ),
  );
  const out = new Uint8Array(HEADER_BYTES + ciphertext.length);
  let at = 0;
  for (const b of MAGIC) out[at++] = b;
  out[at++] = VERSION;
  new DataView(out.buffer).setUint32(at, iterations);
  at += 4;
  out.set(salt, at);
  at += SALT_BYTES;
  out.set(iv, at);
  at += IV_BYTES;
  out.set(ciphertext, at);
  return out;
}

/** Open bytes `sealBytes` wrote. Throws `"Not sealed bytes"` for anything
 *  else, and a {@link WrongPasswordError} when the passphrase does not open
 *  them (or the bytes were tampered with). */
export async function openBytes(
  sealed: Uint8Array,
  passphrase: string,
): Promise<Uint8Array> {
  if (!isSealedBytes(sealed)) throw new Error("Not sealed bytes");
  if (!passphrase) throw new Error("Password is required");
  let at = MAGIC.length + 1;
  const iterations = new DataView(sealed.buffer, sealed.byteOffset).getUint32(
    at,
  );
  at += 4;
  const salt = sealed.slice(at, at + SALT_BYTES);
  at += SALT_BYTES;
  const iv = sealed.slice(at, at + IV_BYTES);
  at += IV_BYTES;
  const ciphertext = sealed.subarray(at);
  const key = await deriveKey(passphrase, salt, iterations);
  try {
    return new Uint8Array(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv as BufferSource },
        key,
        ciphertext as BufferSource,
      ),
    );
  } catch {
    throw new WrongPasswordError();
  }
}

/** Forget every derived key — on a lock or a sign-out. */
export function forgetSealKeys(): void {
  keys.clear();
}
