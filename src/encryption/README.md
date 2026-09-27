<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# `@niclaslindstedt/oss-framework/encryption`

At-rest encryption for a local-first app. A passphrase enciphers the document
wherever its bytes live — `localStorage`, a local folder, a cloud app folder —
because the encryption sits **above** the storage transport, not inside any one
backend. Two pieces:

| Export                                                               | What it is                                                                                            |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `encryptText` / `decryptEnvelope`                                    | Pure AES-GCM + PBKDF2 round-trip over a self-describing JSON **envelope**.                            |
| `parseEnvelope` / `isEncryptedEnvelope`                              | Cheap sniffers — is this string one of our envelopes? (No crypto work.)                               |
| `withEncryption(inner, ref)`                                         | A higher-order `StorageAdapter` that encrypts on `save` and decrypts on `load`, wrapping any backend. |
| `Envelope`, `CryptoProgress`, `PasswordRef`, `WithEncryptionOptions` | The supporting types.                                                                                 |

## What it owns vs. what stays in your app

- **The framework owns** the crypto (the envelope format, the OWASP-aligned KDF
  defaults) and the byte-boundary wrapper. It holds the passphrase **nowhere**.
- **Your app owns** where the passphrase comes from and how long it lives.
  There are no accounts here: the passphrase is collected in your UI and held in
  memory for the session via a `passwordRef` you pass in. After a reload nothing
  holds it, so the app is **locked** — an envelope sits on disk that nothing can
  read — until the user re-enters it. The lock/unlock UI is yours.

## The envelope

`encryptText(plaintext, password)` returns a JSON string:

```jsonc
{
  "encrypted": "oss.encrypted.v1", // discriminator + version
  "kdf": "PBKDF2",
  "hash": "SHA-256",
  "iterations": 600000, // OWASP 2023 password-storage guidance
  "salt": "…", // base64, fresh per envelope
  "iv": "…", // base64, fresh per encryption
  "ciphertext": "…", // base64, AES-256-GCM (auth tag appended)
}
```

It is **self-describing**: salt, IV, and the iteration count travel with the
ciphertext, so it can be decrypted from the password alone — and a future
iteration bump won't break older blobs. Because it's just JSON, an encrypted
document can share the same string-typed storage slot as a plaintext one;
`isEncryptedEnvelope(text)` tells them apart by the `encrypted` discriminator.

A wrong password (or tampered bytes) fails at the AES-GCM authentication tag and
surfaces as `throw new Error("Wrong password")`.

## Quick start

### Encrypt at the storage seam (recommended)

Wrap any framework `StorageAdapter` so your app-state layer never touches crypto:

```ts
import { BrowserLocalStorageAdapter } from "@niclaslindstedt/oss-framework/storage";
import { withEncryption } from "@niclaslindstedt/oss-framework/encryption";

// A live handle on the session passphrase. `null` = pass through unencrypted.
const passwordRef = { current: null as string | null }; // a React `useRef` works

const adapter = withEncryption(
  new BrowserLocalStorageAdapter({ key: "my-app:doc" }),
  passwordRef,
);

// Lock state: encryption on, no passphrase held yet.
passwordRef.current = null;
await adapter.save("hello"); // writes PLAINTEXT (transition window — see below)

// Unlock: set the passphrase the user typed. Now saves encipher, loads decrypt.
passwordRef.current = userPassphrase;
await adapter.save("hello"); // writes an envelope
const snap = await adapter.load(); // → { text: "hello", … }
```

The wrapper reads `passwordRef.current` **fresh on every op**, so enabling,
disabling, and unlocking are all just assignments to `.current` — no need to
re-create the adapter. Key behaviours:

- **`null` password passes bytes through untouched.** This makes enabling
  encryption non-destructive: a plaintext document already on disk is handed
  back as-is by `load` until the next `save` re-wraps it.
- **No `loadSync`.** Decryption is asynchronous, so the wrapper never advertises
  the synchronous fast path even when the inner backend has one; callers fall
  back to `load()`.
- **`watch` decrypts remote pushes** before forwarding them (and drops them if
  no passphrase is held). `getRevision` / `probe` forward unchanged — they don't
  touch the passphrase.

### Use the crypto directly

If you encrypt something other than the storage document (an export blob, a
single field):

```ts
import {
  encryptText,
  decryptEnvelope,
} from "@niclaslindstedt/oss-framework/encryption";

const envelope = await encryptText(secret, passphrase, (step) =>
  setStatus(step),
);
const back = await decryptEnvelope(envelope, passphrase);
```

The optional `onProgress` callback fires `"derivingKey"` → `"encrypting"` /
`"decrypting"` so the UI can flash a status while the (deliberately slow,
~100ms+) key derivation runs. Pair it with the
[`CipherGlyph`](../components/README.md) busy indicator.

### Conflicts come back as plaintext

A save that loses an optimistic-concurrency race throws the inner adapter's
`ConflictError`, whose `remote.text` is the backend's newer copy — an envelope.
`withEncryption` decrypts it before rethrowing, so a caller that merges
`err.remote.text` reads the document. A remote copy that the held passphrase
cannot open surfaces as a `WrongPasswordError` instead.

### Seal plaintext on read

`withEncryption(inner, ref, { sealPlaintext: true })` re-saves a plaintext
document as an envelope the moment a `load` finds one while a passphrase is
held, rather than waiting for the next edit. Use it where plaintext at rest is
the thing being prevented. A cached (`offline`) snapshot is never re-sealed —
the save would only reach the cache.

## Encryption a backend requires

Some backends should never hold plaintext: a cloud app folder, a picked folder
another program may be syncing. `useRequiredEncryption` is the state machine
for that rule:

```tsx
const enc = useRequiredEncryption({
  inner: cloudAdapter, // null when nothing is connected
  required: backend !== "local",
  storageKey: `my-app:sync:passphrase:${backend}`,
});
// enc.adapter is null until a passphrase is held — sync through nothing else.
```

| `state`       | Meaning                                                                    |
| ------------- | -------------------------------------------------------------------------- |
| `off`         | No backend, or one that does not require encryption (`adapter` = `inner`). |
| `checking`    | Reading the backend to know which question to ask.                         |
| `create`      | Nothing sealed there yet — choose a passphrase (`create`).                 |
| `unlock`      | An envelope is there — enter its passphrase (`unlock`).                    |
| `changed`     | The remembered passphrase stopped opening it — enter the new one.          |
| `unreachable` | Could not read, no passphrase held — `recheck` later.                      |
| `ready`       | Passphrase held; `adapter` seals every save and opens every load.          |

The guarantee is structural: `adapter` is `null` whenever a required backend
has no passphrase, so a sync engine that only talks to `adapter` has no path to
write plaintext. The first read after a passphrase lands seals an existing
plaintext copy in place (`sealPlaintext`). `change(next)` re-seals the backend
under a new passphrase; other devices land in `changed` on their next read.

The passphrase is **remembered on the device** under `storageKey` (default
storage `localStorage`), so a device asks once. That is the right trade for an
app whose working copy already sits in plaintext in the same storage — the key
beside it exposes nothing new, and the copy that left the device stays
unreadable to its provider. Pass `storage: null` to hold it for the session
only. `forget()` drops it (on a disconnect). Key it per backend.

`PassphraseDialog` asks every one of those questions — `mode` is `create`,
`unlock`, `changed` or `change`; a chosen passphrase is typed twice and has a
minimum length (`PASSPHRASE_MIN_LENGTH`, 8); a `WrongPasswordError` maps to the
wrong-passphrase copy. Every string injects through `labels`.

## A PIN app lock

`usePinLock({ storageKey, relockAfterMs })` keeps a PBKDF2 verifier (never the
code) in device storage and reports `locked` from the first render when one is
set, and again once the page has been hidden for `relockAfterMs`. Render the
components module's `UnlockGate` as the gate:

```tsx
const pin = usePinLock({ storageKey: "my-app:pin", relockAfterMs: 5 * 60_000 });

<UnlockGate
  open={pin.locked}
  inputMode="numeric"
  icon={<LockIcon className="h-6 w-6" />}
  labels={{ title: "Locked", hint: "Enter your PIN.", passphrase: "PIN" }}
  onUnlock={async (code) => {
    if (!(await pin.unlock(code))) throw new Error("wrong");
  }}
/>;
```

and `PinLockControl` in settings to set, change or remove it. A PIN is a
**soft** lock — a short code has a small keyspace, and it encrypts nothing — so
its default copy says so. Encryption is what protects bytes that leave the
device.

## Diagnostics

`withEncryption` takes an optional `logger` (the storage module's `Logger`
shape) for per-op encrypt/decrypt timing and passthrough notes. It defaults to a
no-op — a library must not write to a console it doesn't own. Wire your in-app
log buffer (see [`logging`](../logging/README.md)) to see the lines:

```ts
withEncryption(inner, ref, { logger: logStore.createLogger("encrypt") });
```

## Adapting to your app

- **The passphrase lives somewhere else.** If you key encryption off an account
  password or an OS keychain instead of a typed passphrase, derive your session
  string there and assign it to `passwordRef.current`. The wrapper doesn't care
  where it came from.
- **You need a per-field, not per-document, scheme.** Use `encryptText` /
  `decryptEnvelope` directly per value rather than `withEncryption`. Each call
  derives a fresh key (slow by design) — for many small fields, derive once with
  the Web Crypto API yourself and reuse the `CryptoKey`.
- **You want a different KDF cost or cipher.** The defaults are fixed (AES-256-GCM,
  PBKDF2-SHA256 @ 600k). The envelope records `iterations`, so raising it stays
  backward-compatible; changing the cipher means a new envelope `version` and a
  read-time migration — open an issue to widen the module rather than forking it.
- **Migrating existing plaintext.** Because a `null` password passes through and
  `load` returns plaintext leftovers untouched, the migration is: set the
  passphrase, then re-`save` once. Until that save runs, the document is still
  readable.
- **A different storage shape.** `withEncryption` wraps anything satisfying
  `StorageAdapter`, including the cloud backends and the `withLocalCache`
  offline wrapper — compose them (`withEncryption(withLocalCache(cloud), ref)`)
  so the cache holds ciphertext too.

## Verification

After wiring, confirm in the running app: enable encryption, save, and inspect
the raw stored bytes — they should be the `oss.encrypted.v1` JSON envelope, not
your plaintext. Drop the session passphrase (simulate a reload) and confirm
`load` throws `"Storage is encrypted; password is required"`; re-enter the right
passphrase and confirm the document returns, the wrong one and confirm
`"Wrong password"`.
