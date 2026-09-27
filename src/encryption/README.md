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

## The encryption kit — the quick way

Everything above is the machinery. Most apps want the finished thing: turn it
on in settings, get locked out after a reload, unlock, change the passphrase,
notice a second device turned it on. That is one hook and two components:

```tsx
import {
  EncryptionGate,
  EncryptionSettings,
  useEncryption,
} from "@niclaslindstedt/oss-framework/encryption";

function App() {
  const encryption = useEncryption({
    adapter: myBackend, // any StorageAdapter, or null when none is connected
    storageKey: "my-app:encryption",
  });
  // Read and write through encryption.adapter — null while locked.
  useMyDocument(encryption.adapter);

  return (
    <>
      <Shell />
      {/* Asks whenever an answer is needed: choose / enter / changed. */}
      <EncryptionGate encryption={encryption} location="Dropbox" blocking />
    </>
  );
}

// In settings:
<EncryptionSettings encryption={encryption} location="Dropbox" />;
```

That is the whole integration. English copy is built in; pass one `labels`
object (`EncryptionLabels`) to both components to translate it, and a
`location` to name where the bytes go (it fills `{location}` in the copy).

### Choosing the behaviour

| Option     | Values                               | Pick…                                                                                                                                                                                                              |
| ---------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `policy`   | `"optional"` (default), `"required"` | `optional` when encryption is a setting the user turns on. `required` when the backend may only ever hold envelopes — a copy that leaves the device. There is no off.                                              |
| `remember` | `"session"` (default), `"device"`    | `session` when the on-device copy is what's protected: a reload locks it. `device` when the working copy is already plaintext on the device and the passphrase guards the copy that leaves it: a device asks once. |
| `storage`  | `localStorage` (default), `null`     | Where the mode (and a `device` passphrase) live.                                                                                                                                                                   |

`storageKey` prefixes what the device keeps (`<key>:mode`,
`<key>:passphrase`). Key it per backend — `my-app:encryption:${backend}` — so
each asks its own question, and keep it a stable string.

### States

| `state`       | Meaning                                                                   | `adapter`              |
| ------------- | ------------------------------------------------------------------------- | ---------------------- |
| `off`         | Not encrypted (optional policy), or no backend.                           | the backend, plaintext |
| `checking`    | Encrypted, no passphrase: reading the backend to know what to ask.        | `null`                 |
| `setup`       | Encrypted, nothing sealed yet — choose a passphrase (`enable`).           | `null`                 |
| `locked`      | An envelope, no passphrase held — enter it (`unlock`).                    | `null`                 |
| `changed`     | The held passphrase stopped opening it: it was changed on another device. | `null`                 |
| `unreachable` | Could not read the backend to decide — `recheck` later.                   | `null`                 |
| `ready`       | Every save sealed, every load opened.                                     | sealing adapter        |

The verbs — `enable`, `disable` (optional only), `unlock`, `changePassphrase`,
`lock`, `forget` (on a disconnect), `recheck` — each take an optional progress
callback of `EncryptionStep`s (`reading` → `derivingKey` → `encrypting` /
`decrypting` → `saving` → `finalizing`) for a status line; the components
already show them on a `CipherGlyph` line.

### What it does for you

- **No plaintext while locked.** `adapter` is `null` whenever the backend is
  encrypted and no passphrase is held, so a sync engine that only talks to it
  cannot write plaintext over an envelope — nor, under `required`, write
  plaintext at all.
- **Adopts encryption from another device.** With the optional policy off, a
  read that finds an envelope switches this device to encrypted and locks
  (`fromRemote` is true, and the gate says so) — the notes behaviour.
- **Seals leftovers.** In `ready`, a plaintext copy is re-written as an
  envelope the first time it is read.
- **Notices a changed passphrase.** A held passphrase that stops opening the
  backend drops to `changed` and is forgotten, so sync stops instead of
  failing on every push.
- **Sticky.** Adoption only goes towards encrypted. Turning it off is each
  device's decision; a device that still holds the passphrase re-seals on its
  next read. (The alternative lets one device quietly unseal everyone.)

### `EncryptionGate` presentations

By default a dismissable **dialog** over the app — right when the app still
works behind it (a local working copy; only sync waits). With `blocking`, a
locked state is the full-screen **`UnlockGate`** instead — right when the
encrypted document _is_ the app. `paused` silences it (while a demo has taken
over storage, say).

### Coming from 3.7.0

3.7.0 shipped a narrower `useRequiredEncryption`. It still works — it is now a
view of `useEncryption` with `policy: "required"` and `remember: "device"`, and
keeps the passphrase under the key it always did — but it is deprecated; call
`useEncryption` directly. `PassphraseDialogLabels` likewise gives way to
`EncryptionLabels` (`unlockSubmit` is `unlock`, `working` is `steps`).

### When the kit is not enough

It seals **one document** behind one adapter. A backend that stores many files
and encrypts each one separately (notes' per-note folders, with opaque file
names and a background re-encryption queue) needs its own state machine; build
it from `encryptText` / `decryptEnvelope` / `withEncryption` as notes does.

## A PIN app lock

`usePinLock({ storageKey, relockAfterMs })` keeps a PBKDF2 verifier (never the
code) in device storage and reports `locked` from the first render when one is
set, and again once the page has been hidden for `relockAfterMs`. Wrap the
shell in `AppLock` — it renders the PIN gate instead of its children while
locked, so nothing behind it paints:

```tsx
const pin = usePinLock({ storageKey: "my-app:pin", relockAfterMs: 5 * 60_000 });

<AppLock pin={pin}>
  <Shell />
</AppLock>;

// In settings:
<PinLockControl pin={pin} />;
```

`PinGate` is the gate on its own, if the shell wants to place it. A PIN is a
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
