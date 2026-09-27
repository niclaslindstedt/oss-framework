// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  aad,
  decryptName,
  deriveNamespaceKeys,
  encryptName,
  envelopeEpoch,
  formatRecoveryKey,
  generateAccountKey,
  generateDeviceKeys,
  importAccountPrivate,
  nameEpoch,
  newRecoveryKey,
  openEnvelope,
  openSealed,
  openWithKey,
  parseRecoveryKey,
  randomBytes,
  recoveryKeyFor,
  safetyCode,
  sealEnvelope,
  sealToPublic,
  sealWithKey,
  secretCode,
  secretKey,
  signMessage,
  utf8,
} from "../src/storage/selfhosted/crypto.ts";
import { DecryptError } from "../src/storage/selfhosted/errors.ts";

const text = (b: Uint8Array) => new TextDecoder().decode(b);

describe("device keys", () => {
  it("generates P-256 key pairs with non-extractable private halves", async () => {
    const d = await generateDeviceKeys();
    expect(d.dsk.privateKey.extractable).toBe(false);
    expect(d.dek.privateKey.extractable).toBe(false);
    expect(d.dskPublic).toMatch(/^[A-Za-z0-9_-]{87}$/); // 65 bytes
    const sig = await signMessage(d.dsk.privateKey, "hello");
    const pub = await crypto.subtle.importKey(
      "raw",
      Uint8Array.from(
        atob(d.dskPublic.replace(/-/g, "+").replace(/_/g, "/")),
        (c) => c.charCodeAt(0),
      ),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const raw = Uint8Array.from(
      atob(sig.replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0),
    );
    expect(raw).toHaveLength(64);
    expect(
      await crypto.subtle.verify(
        { name: "ECDSA", hash: "SHA-256" },
        pub,
        raw,
        new TextEncoder().encode("hello"),
      ),
    ).toBe(true);
  });

  it("derives a 25-digit safety code, stable for the same keys", async () => {
    const d = await generateDeviceKeys();
    const a = await safetyCode(d.dskPublic, d.dekPublic);
    expect(a).toMatch(/^\d{5}( \d{5}){4}$/);
    expect(await safetyCode(d.dskPublic, d.dekPublic)).toBe(a);
  });
});

describe("sealing to a public key (ECDH-ES)", () => {
  it("round-trips and binds the context", async () => {
    const acc = await generateAccountKey();
    const priv = await importAccountPrivate(acc.pkcs8);
    const sealed = await sealToPublic(
      acc.publicRaw,
      utf8("namespace key"),
      "nk|ns_1|1|acc_a",
    );
    expect(text(await openSealed(priv, sealed, "nk|ns_1|1|acc_a"))).toBe(
      "namespace key",
    );
    await expect(
      openSealed(priv, sealed, "nk|ns_2|1|acc_a"),
    ).rejects.toBeInstanceOf(DecryptError);
    const other = await importAccountPrivate(
      (await generateAccountKey()).pkcs8,
    );
    await expect(
      openSealed(other, sealed, "nk|ns_1|1|acc_a"),
    ).rejects.toBeInstanceOf(DecryptError);
  });

  it("works with a device key-agreement key", async () => {
    const d = await generateDeviceKeys();
    const sealed = await sealToPublic(d.dekPublic, utf8("aek"), "aek|acc|dev");
    expect(
      text(await openSealed(d.dek.privateKey, sealed, "aek|acc|dev")),
    ).toBe("aek");
  });
});

describe("out-of-band secrets", () => {
  it("derive a server code and a separate sealing key", async () => {
    const x = randomBytes(32);
    const code = await secretCode(x);
    expect(code).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await secretCode(x)).toBe(code);
    const k = await secretKey(x);
    const sealed = await sealWithKey(k, utf8("payload"), "invite");
    expect(text(await openWithKey(await secretKey(x), sealed, "invite"))).toBe(
      "payload",
    );
    await expect(
      openWithKey(await secretKey(randomBytes(32)), sealed, "invite"),
    ).rejects.toBeInstanceOf(DecryptError);
  });
});

describe("recovery key", () => {
  it("formats as 14 groups of 4 and parses tolerantly", async () => {
    const rk = newRecoveryKey();
    const s = await formatRecoveryKey(rk);
    expect(s).toMatch(/^([0-9A-HJKMNP-TV-Z]{4}-){13}[0-9A-HJKMNP-TV-Z]{4}$/);
    expect([...(await parseRecoveryKey(s))]).toEqual([...rk]);
    const sloppy = s
      .toLowerCase()
      .replace(/-/g, " ")
      .replace(/0/g, "o")
      .replace(/1/g, "l");
    expect([...(await parseRecoveryKey(sloppy))]).toEqual([...rk]);
  });

  it("rejects typos via its checksum", async () => {
    const s = await formatRecoveryKey(newRecoveryKey());
    const typo = (s[0] === "A" ? "B" : "A") + s.slice(1);
    await expect(parseRecoveryKey(typo)).rejects.toThrow(/recovery key/i);
    await expect(parseRecoveryKey("too-short")).rejects.toThrow(
      /recovery key/i,
    );
  });

  it("derives an account-bound key", async () => {
    const rk = newRecoveryKey();
    const a = await recoveryKeyFor(rk, "acc_1");
    const sealed = await sealWithKey(a, utf8("pkcs8"), "recovery");
    expect(
      text(
        await openWithKey(
          await recoveryKeyFor(rk, "acc_1"),
          sealed,
          "recovery",
        ),
      ),
    ).toBe("pkcs8");
    await expect(
      openWithKey(await recoveryKeyFor(rk, "acc_2"), sealed, "recovery"),
    ).rejects.toBeInstanceOf(DecryptError);
  });
});

describe("namespace envelopes and names", () => {
  it("seals OSE1 envelopes bound to their place", async () => {
    const nk = randomBytes(32);
    const keys = await deriveNamespaceKeys(nk, "ns_1", 3);
    const env = await sealEnvelope(
      keys,
      utf8('{"doses":1}'),
      aad.file("ns_1", "cid_a"),
    );
    expect([...env.slice(0, 5)]).toEqual([0x4f, 0x53, 0x45, 0x31, 1]);
    expect(envelopeEpoch(env)).toBe(3);
    const open = await openEnvelope(() => keys, env, aad.file("ns_1", "cid_a"));
    expect(text(open)).toBe('{"doses":1}');
    await expect(
      openEnvelope(() => keys, env, aad.file("ns_1", "cid_b")),
    ).rejects.toBeInstanceOf(DecryptError);
    const other = await deriveNamespaceKeys(nk, "ns_2", 3);
    await expect(
      openEnvelope(() => other, env, aad.file("ns_1", "cid_a")),
    ).rejects.toBeInstanceOf(DecryptError);
    // fresh IV every time
    const env2 = await sealEnvelope(
      keys,
      utf8('{"doses":1}'),
      aad.file("ns_1", "cid_a"),
    );
    expect(env2).not.toEqual(env);
  });

  it("encrypts names deterministically per epoch, with a URL-safe token", async () => {
    const nk = randomBytes(32);
    const k1 = await deriveNamespaceKeys(nk, "ns_1", 1);
    const k2 = await deriveNamespaceKeys(randomBytes(32), "ns_1", 2);
    const a = await encryptName(k1, "Blodtryck 2026-09.md");
    expect(await encryptName(k1, "Blodtryck 2026-09.md")).toBe(a);
    expect(a).toMatch(/^1\.[A-Za-z0-9_-]+$/);
    expect(nameEpoch(a)).toBe(1);
    expect(await encryptName(k1, "other")).not.toBe(a);
    expect(await decryptName(k1, a)).toBe("Blodtryck 2026-09.md");
    const b = await encryptName(k2, "Blodtryck 2026-09.md");
    expect(b.startsWith("2.")).toBe(true);
    await expect(decryptName(k1, b)).rejects.toBeInstanceOf(DecryptError);
    await expect(encryptName(k1, "a/b")).rejects.toThrow(/segment/);
    await expect(encryptName(k1, "")).rejects.toThrow(/segment/);
  });
});
