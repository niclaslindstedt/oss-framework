// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The self-hosted backend's end-to-end encryption (SPEC §4.3), on WebCrypto
// only: P-256 ECDSA/ECDH, HKDF-SHA-256, AES-256-GCM and HMAC-SHA-256 — all
// available in every browser, Node and native WebView, and all
// FIPS-approved. The server never runs any of this; it stores the output.

import { fromBase64Url, toBase64Url } from "../base64url.ts";
import { DecryptError } from "./errors.ts";

const subtle = () => globalThis.crypto.subtle;
const PREFIX = "oss-storage/v1";

/** Coerce to an ArrayBuffer-backed view (WebCrypto's BufferSource typing). */
const buf = (b: Uint8Array): Uint8Array<ArrayBuffer> => new Uint8Array(b);

export function randomBytes(n: number): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(n));
}

export function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function fromUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export const b64u = toBase64Url;
export const unb64u = fromBase64Url;

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await subtle().digest("SHA-256", buf(data)));
}

// ---- device keys -----------------------------------------------------------

export type DeviceKeyPair = {
  /** ECDSA P-256: signs authentication challenges. */
  dsk: CryptoKeyPair;
  /** ECDH P-256: receives the account key sealed to this device. */
  dek: CryptoKeyPair;
  dskPublic: string;
  dekPublic: string;
};

/**
 * Generate a device's key pairs. Private halves are non-extractable unless a
 * native key vault needs the bytes to store them in the platform keystore.
 */
export async function generateDeviceKeys(
  extractable = false,
): Promise<DeviceKeyPair> {
  const dsk = await subtle().generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    extractable,
    ["sign", "verify"],
  );
  const dek = await subtle().generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    extractable,
    ["deriveBits"],
  );
  return {
    dsk,
    dek,
    dskPublic: b64u(
      new Uint8Array(await subtle().exportKey("raw", dsk.publicKey)),
    ),
    dekPublic: b64u(
      new Uint8Array(await subtle().exportKey("raw", dek.publicKey)),
    ),
  };
}

/** ECDSA P-256 / SHA-256 signature (IEEE P1363, 64 bytes), base64url. */
export async function signMessage(
  key: CryptoKey,
  message: string,
): Promise<string> {
  const sig = await subtle().sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    buf(utf8(message)),
  );
  return b64u(new Uint8Array(sig));
}

/** The message a device signs to sign in (SPEC §6.1). */
export function authMessage(
  serverId: string,
  deviceId: string,
  challenge: string,
): string {
  return `${PREFIX}/auth|${serverId}|${deviceId}|${challenge}`;
}

/**
 * 25 decimal digits from SHA-256 over a device's two public keys, in groups
 * of five — what two screens compare before one hands the other the account
 * key. Identical to the server's derivation.
 */
export async function safetyCode(
  dskPublic: string,
  dekPublic: string,
): Promise<string> {
  const d = await sha256(concatBytes(unb64u(dskPublic), unb64u(dekPublic)));
  const groups: string[] = [];
  for (let g = 0; g < 5; g++) {
    const n =
      ((d[g * 4]! << 24) |
        (d[g * 4 + 1]! << 16) |
        (d[g * 4 + 2]! << 8) |
        d[g * 4 + 3]!) >>>
      0;
    groups.push(String(n % 100000).padStart(5, "0"));
  }
  return groups.join(" ");
}

// ---- account key and ECDH-ES sealing ------------------------------------------

/** A fresh account key pair: raw public point + PKCS#8 private bytes. */
export async function generateAccountKey(): Promise<{
  publicRaw: string;
  pkcs8: Uint8Array;
}> {
  const pair = await subtle().generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  return {
    publicRaw: b64u(
      new Uint8Array(await subtle().exportKey("raw", pair.publicKey)),
    ),
    pkcs8: new Uint8Array(await subtle().exportKey("pkcs8", pair.privateKey)),
  };
}

export function importAccountPrivate(
  pkcs8: Uint8Array,
  extractable = false,
): Promise<CryptoKey> {
  return subtle().importKey(
    "pkcs8",
    buf(pkcs8),
    { name: "ECDH", namedCurve: "P-256" },
    extractable,
    ["deriveBits"],
  );
}

export function importEcdhPublic(raw: string): Promise<CryptoKey> {
  return subtle().importKey(
    "raw",
    buf(unb64u(raw)),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
}

async function hkdfKey(
  secret: Uint8Array,
  salt: Uint8Array,
  info: string,
  alg: "AES-GCM" | "HMAC",
): Promise<CryptoKey> {
  const base = await subtle().importKey("raw", buf(secret), "HKDF", false, [
    "deriveKey",
    "deriveBits",
  ]);
  return subtle().deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: buf(salt), info: buf(utf8(info)) },
    base,
    alg === "AES-GCM"
      ? { name: "AES-GCM", length: 256 }
      : { name: "HMAC", hash: "SHA-256", length: 256 },
    false,
    alg === "AES-GCM" ? ["encrypt", "decrypt"] : ["sign"],
  );
}

async function hkdfBytes(
  secret: Uint8Array,
  salt: Uint8Array,
  info: string,
): Promise<Uint8Array> {
  const base = await subtle().importKey("raw", buf(secret), "HKDF", false, [
    "deriveBits",
  ]);
  return new Uint8Array(
    await subtle().deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: buf(salt), info: buf(utf8(info)) },
      base,
      256,
    ),
  );
}

async function gcmEncrypt(
  key: CryptoKey,
  plaintext: Uint8Array,
  aadText: string,
  iv = randomBytes(12),
) {
  const ct = await subtle().encrypt(
    { name: "AES-GCM", iv: buf(iv), additionalData: buf(utf8(aadText)) },
    key,
    buf(plaintext),
  );
  return { iv, ct: new Uint8Array(ct) };
}

async function gcmDecrypt(
  key: CryptoKey,
  iv: Uint8Array,
  ct: Uint8Array,
  aadText: string,
): Promise<Uint8Array> {
  try {
    return new Uint8Array(
      await subtle().decrypt(
        { name: "AES-GCM", iv: buf(iv), additionalData: buf(utf8(aadText)) },
        key,
        buf(ct),
      ),
    );
  } catch {
    throw new DecryptError();
  }
}

/**
 * Seal bytes to a P-256 public key (ECDH-ES): an ephemeral key pair, HKDF over
 * the shared secret, AES-256-GCM bound to `context`. Output: epk ‖ iv ‖ ct.
 */
export async function sealToPublic(
  recipientPublic: string,
  plaintext: Uint8Array,
  context: string,
): Promise<string> {
  const eph = await subtle().generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"],
  );
  const epk = new Uint8Array(await subtle().exportKey("raw", eph.publicKey));
  const z = new Uint8Array(
    await subtle().deriveBits(
      { name: "ECDH", public: await importEcdhPublic(recipientPublic) },
      eph.privateKey,
      256,
    ),
  );
  const key = await hkdfKey(z, epk, `${PREFIX}/wrap|${context}`, "AES-GCM");
  const { iv, ct } = await gcmEncrypt(key, plaintext, context);
  return b64u(concatBytes(epk, iv, ct));
}

export async function openSealed(
  privateKey: CryptoKey,
  sealed: string,
  context: string,
): Promise<Uint8Array> {
  let bytes: Uint8Array;
  try {
    bytes = unb64u(sealed);
  } catch {
    throw new DecryptError("malformed sealed key");
  }
  if (bytes.length < 65 + 12 + 16)
    throw new DecryptError("malformed sealed key");
  const epk = bytes.slice(0, 65);
  try {
    const pub = await subtle().importKey(
      "raw",
      buf(epk),
      { name: "ECDH", namedCurve: "P-256" },
      false,
      [],
    );
    const z = new Uint8Array(
      await subtle().deriveBits({ name: "ECDH", public: pub }, privateKey, 256),
    );
    const key = await hkdfKey(z, epk, `${PREFIX}/wrap|${context}`, "AES-GCM");
    return await gcmDecrypt(key, bytes.slice(65, 77), bytes.slice(77), context);
  } catch (err) {
    if (err instanceof DecryptError) throw err;
    throw new DecryptError();
  }
}

// ---- out-of-band secrets (device-to-device pairing, invites) --------------------

const NO_SALT = new Uint8Array(32);

/** What the server gets to authorise a pairing or invite: HKDF(X, "code"). */
export async function secretCode(x: Uint8Array): Promise<string> {
  return b64u(await hkdfBytes(x, NO_SALT, `${PREFIX}/code`));
}

/** The key the payload is sealed under: HKDF(X, "key") — never sent. */
export function secretKey(x: Uint8Array): Promise<CryptoKey> {
  return hkdfKey(x, NO_SALT, `${PREFIX}/key`, "AES-GCM");
}

export async function sealWithKey(
  key: CryptoKey,
  plaintext: Uint8Array,
  aadText: string,
): Promise<string> {
  const { iv, ct } = await gcmEncrypt(key, plaintext, aadText);
  return b64u(concatBytes(iv, ct));
}

export async function openWithKey(
  key: CryptoKey,
  sealed: string,
  aadText: string,
): Promise<Uint8Array> {
  let bytes: Uint8Array;
  try {
    bytes = unb64u(sealed);
  } catch {
    throw new DecryptError("malformed sealed payload");
  }
  if (bytes.length < 12 + 16)
    throw new DecryptError("malformed sealed payload");
  return gcmDecrypt(key, bytes.slice(0, 12), bytes.slice(12), aadText);
}

// ---- recovery key ----------------------------------------------------------------

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function toBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += CROCKFORD[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += CROCKFORD[(value << (5 - bits)) & 31];
  return out;
}

function fromBase32(text: string, bytes: number): Uint8Array {
  const out = new Uint8Array(bytes);
  let bits = 0;
  let value = 0;
  let i = 0;
  for (const c of text) {
    const v = CROCKFORD.indexOf(c);
    if (v < 0) throw new Error("not a recovery key: bad character");
    value = ((value << 5) | v) & 0xffff;
    bits += 5;
    if (bits >= 8 && i < bytes) {
      out[i++] = (value >>> (bits - 8)) & 0xff;
      bits -= 8;
    }
  }
  return out;
}

export function newRecoveryKey(): Uint8Array {
  return randomBytes(32);
}

async function checksum(bytes: Uint8Array): Promise<string> {
  const d = await sha256(bytes);
  return toBase32(d.slice(0, 3)).slice(0, 4); // 20 bits
}

/** 52 data + 4 checksum characters, Crockford base32, in 14 groups of four. */
export async function formatRecoveryKey(bytes: Uint8Array): Promise<string> {
  const all = toBase32(bytes) + (await checksum(bytes));
  return all.match(/.{4}/g)!.join("-");
}

/** Parse a recovery key as typed: any case, spaces or dashes, O→0, I/L→1. */
export async function parseRecoveryKey(text: string): Promise<Uint8Array> {
  const clean = text
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1")
    .replace(/U/g, "V");
  if (clean.length !== 56)
    throw new Error(
      "not a recovery key: it has 56 characters in groups of four",
    );
  const bytes = fromBase32(clean.slice(0, 52), 32);
  if ((await checksum(bytes)) !== clean.slice(52)) {
    throw new Error(
      "not a recovery key: a character is mistyped (checksum mismatch)",
    );
  }
  return bytes;
}

/** The key that seals the account key under a recovery key. */
export function recoveryKeyFor(
  rk: Uint8Array,
  accountId: string,
): Promise<CryptoKey> {
  return hkdfKey(rk, utf8(accountId), `${PREFIX}/recovery`, "AES-GCM");
}

// ---- namespace keys, envelopes and names --------------------------------------------

export type NamespaceKeySet = {
  epoch: number;
  content: CryptoKey;
  nameMac: CryptoKey;
  nameEnc: CryptoKey;
};

export async function deriveNamespaceKeys(
  nk: Uint8Array,
  namespaceId: string,
  epoch: number,
): Promise<NamespaceKeySet> {
  const salt = utf8(namespaceId);
  return {
    epoch,
    content: await hkdfKey(nk, salt, `${PREFIX}/content`, "AES-GCM"),
    nameMac: await hkdfKey(nk, salt, `${PREFIX}/name-mac`, "HMAC"),
    nameEnc: await hkdfKey(nk, salt, `${PREFIX}/name-enc`, "AES-GCM"),
  };
}

/** Additional authenticated data: binds each ciphertext to its place. */
export const aad = {
  file: (ns: string, cid: string) => `${PREFIX}|${ns}|file|${cid}`,
  meta: (ns: string, encPath: string) => `${PREFIX}|${ns}|meta|${encPath}`,
  record: (ns: string, encCollection: string, encKey: string) =>
    `${PREFIX}|${ns}|record|${encCollection}/${encKey}`,
  nsmeta: (ns: string) => `${PREFIX}|${ns}|nsmeta|`,
};

const MAGIC = [0x4f, 0x53, 0x45, 0x31];

/** `OSE1` | version 1 | epoch u32 BE | iv | AES-256-GCM(ciphertext ‖ tag). */
export async function sealEnvelope(
  keys: NamespaceKeySet,
  plaintext: Uint8Array,
  aadText: string,
): Promise<Uint8Array> {
  const header = new Uint8Array(9);
  header.set(MAGIC, 0);
  header[4] = 1;
  new DataView(header.buffer).setUint32(5, keys.epoch);
  const { iv, ct } = await gcmEncrypt(keys.content, plaintext, aadText);
  return concatBytes(header, iv, ct);
}

export function envelopeEpoch(bytes: Uint8Array): number {
  if (
    bytes.length < 9 + 12 + 16 ||
    MAGIC.some((m, i) => bytes[i] !== m) ||
    bytes[4] !== 1
  ) {
    throw new DecryptError("not an OSE1 envelope");
  }
  return new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  ).getUint32(5);
}

export async function openEnvelope(
  keysFor: (epoch: number) => NamespaceKeySet | Promise<NamespaceKeySet>,
  bytes: Uint8Array,
  aadText: string,
): Promise<Uint8Array> {
  const keys = await keysFor(envelopeEpoch(bytes));
  return gcmDecrypt(keys.content, bytes.slice(9, 21), bytes.slice(21), aadText);
}

const MAX_SEGMENT_BYTES = 255;

/**
 * Deterministic name encryption (a synthetic-IV construction): the IV is an
 * HMAC of the name, so equal names give equal tokens — prefix listing and
 * lookups work — while the server learns nothing but equality. The token
 * carries its key epoch: `<epoch base36>.<b64u(iv ‖ ct)>`.
 */
export async function encryptName(
  keys: NamespaceKeySet,
  segment: string,
): Promise<string> {
  const bytes = utf8(segment);
  if (
    segment.length === 0 ||
    segment.includes("/") ||
    bytes.length > MAX_SEGMENT_BYTES
  ) {
    throw new Error(
      `invalid name segment: must be 1-${MAX_SEGMENT_BYTES} bytes without "/"`,
    );
  }
  const mac = new Uint8Array(
    await subtle().sign("HMAC", keys.nameMac, buf(utf8(`seg|${segment}`))),
  );
  const iv = mac.slice(0, 12);
  const { ct } = await gcmEncrypt(keys.nameEnc, bytes, `${PREFIX}|name`, iv);
  return `${keys.epoch.toString(36)}.${b64u(concatBytes(iv, ct))}`;
}

export function nameEpoch(token: string): number {
  const dot = token.indexOf(".");
  const epoch = dot > 0 ? parseInt(token.slice(0, dot), 36) : NaN;
  if (!Number.isSafeInteger(epoch) || epoch < 1)
    throw new DecryptError("not an encrypted name");
  return epoch;
}

export async function decryptName(
  keys: NamespaceKeySet,
  token: string,
): Promise<string> {
  if (nameEpoch(token) !== keys.epoch)
    throw new DecryptError("name is sealed under another epoch");
  let bytes: Uint8Array;
  try {
    bytes = unb64u(token.slice(token.indexOf(".") + 1));
  } catch {
    throw new DecryptError("not an encrypted name");
  }
  if (bytes.length < 12 + 16) throw new DecryptError("not an encrypted name");
  return fromUtf8(
    await gcmDecrypt(
      keys.nameEnc,
      bytes.slice(0, 12),
      bytes.slice(12),
      `${PREFIX}|name`,
    ),
  );
}
