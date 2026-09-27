// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  decryptEnvelope,
  encryptText,
  isEncryptedEnvelope,
} from "../src/encryption/crypto.ts";
import { withEncryption } from "../src/encryption/encrypting.ts";
import { PassphraseDialog } from "../src/encryption/PassphraseDialog.tsx";
import {
  EncryptionLockedError,
  WrongPasswordError,
} from "../src/encryption/errors.ts";
import {
  createPinVerifier,
  isPinVerifier,
  verifyPin,
} from "../src/encryption/pin.ts";
import { usePinLock } from "../src/encryption/usePinLock.ts";
import {
  classifyStored,
  useRequiredEncryption,
} from "../src/encryption/useRequiredEncryption.ts";
import {
  ConflictError,
  type AdapterCapability,
  type StorageAdapter,
  type StoredSnapshot,
} from "../src/storage/adapter.ts";

// A revisioned in-memory backend that refuses a stale base revision the way a
// cloud adapter does, so the conflict path is exercised for real.
function backend(initial: string | null = null) {
  let rev = 0;
  const self = {
    id: "dropbox" as const,
    label: "Memory",
    capabilities: new Set<AdapterCapability>(),
    stored: (initial === null
      ? null
      : { text: initial, revision: "r0" }) as StoredSnapshot | null,
    async load() {
      return self.stored;
    },
    async save(text: string, base?: string) {
      if (self.stored && base !== self.stored.revision) {
        throw new ConflictError(self.stored);
      }
      rev += 1;
      self.stored = { text, revision: `r${rev}` };
      return self.stored;
    },
  };
  return self satisfies StorageAdapter;
}

function memoryStorage(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

describe("typed passphrase errors", () => {
  it("a wrong passphrase is a WrongPasswordError with the old message", async () => {
    const env = await encryptText("x", "right one");
    const err = await decryptEnvelope(env, "wrong one").catch((e) => e);
    expect(err).toBeInstanceOf(WrongPasswordError);
    expect((err as Error).message).toBe("Wrong password");
  });

  it("a locked read is an EncryptionLockedError", async () => {
    const inner = backend(await encryptText("x", "pw"));
    const err = await withEncryption(inner, { current: null })
      .load()
      .catch((e) => e);
    expect(err).toBeInstanceOf(EncryptionLockedError);
  });
});

describe("withEncryption conflicts and sealing", () => {
  it("hands a conflict's remote copy up as plaintext", async () => {
    const inner = backend(await encryptText("theirs", "pw"));
    const enc = withEncryption(inner, { current: "pw" });
    const err = await enc.save("mine", "stale").catch((e) => e);
    expect(err).toBeInstanceOf(ConflictError);
    expect((err as ConflictError).remote.text).toBe("theirs");
    expect((err as ConflictError).remote.revision).toBe("r0");
  });

  it("a conflict sealed under another passphrase is a wrong passphrase", async () => {
    const inner = backend(await encryptText("theirs", "new"));
    const err = await withEncryption(inner, { current: "old" })
      .save("mine", "stale")
      .catch((e) => e);
    expect(err).toBeInstanceOf(WrongPasswordError);
  });

  it("seals a plaintext copy on first read when asked to", async () => {
    const inner = backend("plain");
    const enc = withEncryption(
      inner,
      { current: "pw" },
      { sealPlaintext: true },
    );
    const snap = await enc.load();
    expect(snap?.text).toBe("plain");
    expect(snap?.revision).toBe("r1");
    expect(isEncryptedEnvelope(inner.stored!.text)).toBe(true);
  });

  it("leaves a plaintext copy alone by default", async () => {
    const inner = backend("plain");
    await withEncryption(inner, { current: "pw" }).load();
    expect(inner.stored!.text).toBe("plain");
  });
});

describe("classifyStored", () => {
  it("tells empty, plaintext and envelopes apart", async () => {
    expect(classifyStored(null)).toBe("empty");
    expect(classifyStored({ text: "" })).toBe("empty");
    expect(classifyStored({ text: "{}" })).toBe("plaintext");
    expect(classifyStored({ text: await encryptText("x", "pw") })).toBe(
      "encrypted",
    );
  });
});

describe("useRequiredEncryption", () => {
  it("passes a backend that does not require encryption straight through", () => {
    const inner = backend();
    const { result } = renderHook(() =>
      useRequiredEncryption({
        inner,
        required: false,
        storage: memoryStorage(),
        storageKey: "k",
      }),
    );
    expect(result.current.state).toBe("off");
    expect(result.current.adapter).toBe(inner);
  });

  it("holds every write back until a passphrase is chosen, then seals", async () => {
    const inner = backend("plain doc");
    const storage = memoryStorage();
    const { result } = renderHook(() =>
      useRequiredEncryption({
        inner,
        required: true,
        storage,
        storageKey: "k",
      }),
    );
    expect(result.current.adapter).toBeNull();
    await waitFor(() => expect(result.current.state).toBe("create"));
    expect(result.current.adapter).toBeNull();

    await act(() => result.current.create("a long passphrase"));
    expect(result.current.state).toBe("ready");
    expect(storage.map.get("k")).toBe("a long passphrase");

    // The first read seals the old plaintext copy in place.
    const snap = await result.current.adapter!.load();
    expect(snap?.text).toBe("plain doc");
    expect(isEncryptedEnvelope(inner.stored!.text)).toBe(true);
  });

  it("asks for the existing passphrase when the backend holds an envelope", async () => {
    const inner = backend(await encryptText("doc", "their passphrase"));
    const storage = memoryStorage();
    const { result } = renderHook(() =>
      useRequiredEncryption({
        inner,
        required: true,
        storage,
        storageKey: "k",
      }),
    );
    await waitFor(() => expect(result.current.state).toBe("unlock"));

    await expect(
      act(() => result.current.unlock("a guess")),
    ).rejects.toBeInstanceOf(WrongPasswordError);
    expect(result.current.state).toBe("unlock");
    expect(storage.map.has("k")).toBe(false);

    await act(() => result.current.unlock("their passphrase"));
    expect(result.current.state).toBe("ready");
    expect((await result.current.adapter!.load())?.text).toBe("doc");
  });

  it("starts ready on a device that remembers the passphrase", async () => {
    const inner = backend(await encryptText("doc", "pw pw pw pw"));
    const { result } = renderHook(() =>
      useRequiredEncryption({
        inner,
        required: true,
        storage: memoryStorage({ k: "pw pw pw pw" }),
        storageKey: "k",
      }),
    );
    expect(result.current.state).toBe("ready");
    expect((await result.current.adapter!.load())?.text).toBe("doc");
  });

  it("drops to `changed` when the remembered passphrase stops opening it", async () => {
    const inner = backend(await encryptText("doc", "new passphrase"));
    const storage = memoryStorage({ k: "old passphrase" });
    const { result } = renderHook(() =>
      useRequiredEncryption({
        inner,
        required: true,
        storage,
        storageKey: "k",
      }),
    );
    const adapter = result.current.adapter!;
    await act(async () => {
      await expect(adapter.load()).rejects.toBeInstanceOf(WrongPasswordError);
    });
    expect(result.current.state).toBe("changed");
    expect(result.current.adapter).toBeNull();
    expect(storage.map.has("k")).toBe(false);
    // The check that follows does not paper over the reason.
    await waitFor(() => expect(result.current.state).toBe("changed"));
  });

  it("re-seals the backend under a changed passphrase", async () => {
    const inner = backend(await encryptText("doc", "first passphrase"));
    const storage = memoryStorage({ k: "first passphrase" });
    const { result } = renderHook(() =>
      useRequiredEncryption({
        inner,
        required: true,
        storage,
        storageKey: "k",
      }),
    );
    await act(() => result.current.change("second passphrase"));
    expect(storage.map.get("k")).toBe("second passphrase");
    expect(await decryptEnvelope(inner.stored!.text, "second passphrase")).toBe(
      "doc",
    );
  });

  it("reports an unreadable backend instead of guessing the question", async () => {
    const inner: StorageAdapter = {
      ...backend(),
      load: () => Promise.reject(new TypeError("Failed to fetch")),
    };
    const { result } = renderHook(() =>
      useRequiredEncryption({
        inner,
        required: true,
        storage: memoryStorage(),
        storageKey: "k",
      }),
    );
    await waitFor(() => expect(result.current.state).toBe("unreachable"));
    expect(result.current.error).toBeInstanceOf(TypeError);
  });

  it("forgets the passphrase on a disconnect", async () => {
    const storage = memoryStorage({ k: "pw pw pw pw" });
    const { result } = renderHook(() =>
      useRequiredEncryption({
        inner: backend(),
        required: true,
        storage,
        storageKey: "k",
      }),
    );
    act(() => result.current.forget());
    expect(storage.map.has("k")).toBe(false);
    await waitFor(() => expect(result.current.state).toBe("create"));
  });
});

describe("PIN verifier", () => {
  it("verifies the right code and refuses a wrong one", async () => {
    const v = await createPinVerifier("2468");
    expect(isPinVerifier(v)).toBe(true);
    expect(JSON.stringify(v)).not.toContain("2468");
    expect(await verifyPin("2468", v)).toBe(true);
    expect(await verifyPin("2469", v)).toBe(false);
  });

  it("refuses a code shorter than the minimum", async () => {
    await expect(createPinVerifier("12")).rejects.toThrow();
  });
});

describe("usePinLock", () => {
  it("is open with no PIN, and locks from the first render with one", async () => {
    const storage = memoryStorage();
    const { result } = renderHook(() =>
      usePinLock({ storage, storageKey: "pin" }),
    );
    expect(result.current.locked).toBe(false);
    await act(async () => {
      expect(await result.current.setPin("1357")).toBe(true);
    });
    expect(result.current.hasPin).toBe(true);

    const second = renderHook(() => usePinLock({ storage, storageKey: "pin" }));
    expect(second.result.current.locked).toBe(true);
    await act(async () => {
      expect(await second.result.current.unlock("0000")).toBe(false);
    });
    expect(second.result.current.locked).toBe(true);
    await act(async () => {
      expect(await second.result.current.unlock("1357")).toBe(true);
    });
    expect(second.result.current.locked).toBe(false);
  });

  it("changes and removes the PIN only with the current one", async () => {
    const storage = memoryStorage();
    const { result } = renderHook(() =>
      usePinLock({ storage, storageKey: "pin" }),
    );
    await act(async () => void (await result.current.setPin("1357")));
    await act(async () => {
      expect(await result.current.setPin("2468", "0000")).toBe(false);
      expect(await result.current.clearPin("0000")).toBe(false);
    });
    expect(result.current.hasPin).toBe(true);
    await act(async () => {
      expect(await result.current.clearPin("1357")).toBe(true);
    });
    expect(result.current.hasPin).toBe(false);
    expect(storage.map.has("pin")).toBe(false);
  });
});

describe("PassphraseDialog", () => {
  it("asks twice when choosing and refuses a mismatch", async () => {
    const submitted: string[] = [];
    render(
      <PassphraseDialog
        open
        mode="create"
        onSubmit={async (p) => void submitted.push(p)}
        onClose={() => {}}
      />,
    );
    const first = screen.getByPlaceholderText("Passphrase");
    const second = screen.getByPlaceholderText("Repeat the passphrase");
    fireEvent.input(first, { target: { value: "long enough one" } });
    fireEvent.input(second, { target: { value: "long enough two" } });
    fireEvent.click(screen.getByRole("button", { name: "Encrypt" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "don't match",
    );
    expect(submitted).toEqual([]);

    fireEvent.input(second, { target: { value: "long enough one" } });
    fireEvent.click(screen.getByRole("button", { name: "Encrypt" }));
    await waitFor(() => expect(submitted).toEqual(["long enough one"]));
  });

  it("shows the wrong-passphrase copy when checking fails", async () => {
    render(
      <PassphraseDialog
        open
        mode="unlock"
        onSubmit={() => Promise.reject(new WrongPasswordError())}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByPlaceholderText("Repeat the passphrase")).toBeNull();
    fireEvent.input(screen.getByPlaceholderText("Passphrase"), {
      target: { value: "guess" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Wrong passphrase",
    );
  });
});
