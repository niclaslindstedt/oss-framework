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
import { EncryptionGate } from "../src/encryption/EncryptionGate.tsx";
import { EncryptionSettings } from "../src/encryption/EncryptionSettings.tsx";
import {
  classifyStored,
  useEncryption,
} from "../src/encryption/useEncryption.ts";
import { useRequiredEncryption } from "../src/encryption/useRequiredEncryption.ts";
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

let keySeq = 0;
// A fresh device-storage key per test: session passphrases are shared by key.
const freshKey = () => `test:${++keySeq}`;

describe("useEncryption — required policy", () => {
  it("holds every write back until a passphrase is chosen, then seals", async () => {
    const inner = backend("plain doc");
    const storage = memoryStorage();
    const storageKey = freshKey();
    const { result } = renderHook(() =>
      useEncryption({
        adapter: inner,
        policy: "required",
        remember: "device",
        storage,
        storageKey,
      }),
    );
    expect(result.current.adapter).toBeNull();
    await waitFor(() => expect(result.current.state).toBe("setup"));
    expect(result.current.adapter).toBeNull();

    const steps: string[] = [];
    await act(() =>
      result.current.enable("a long passphrase", (s) => steps.push(s)),
    );
    expect(steps).toEqual([
      "reading",
      "derivingKey",
      "encrypting",
      "saving",
      "finalizing",
    ]);
    expect(result.current.state).toBe("ready");
    expect(storage.map.get(`${storageKey}:passphrase`)).toBe(
      "a long passphrase",
    );
    expect(isEncryptedEnvelope(inner.stored!.text)).toBe(true);
    expect((await result.current.adapter!.load())?.text).toBe("plain doc");
  });

  it("refuses a passphrase shorter than the minimum", async () => {
    const { result } = renderHook(() =>
      useEncryption({
        adapter: backend(),
        policy: "required",
        storage: memoryStorage(),
        storageKey: "test:site:0",
      }),
    );
    await expect(result.current.enable("short")).rejects.toThrow(/at least/);
  });

  it("cannot be turned off", async () => {
    const { result } = renderHook(() =>
      useEncryption({
        adapter: backend(),
        policy: "required",
        storage: memoryStorage(),
        storageKey: "test:site:1",
      }),
    );
    await expect(result.current.disable()).rejects.toThrow(/required/);
  });

  it("asks for the existing passphrase when the backend holds an envelope", async () => {
    const inner = backend(await encryptText("doc", "their passphrase"));
    const { result } = renderHook(() =>
      useEncryption({
        adapter: inner,
        policy: "required",
        storage: memoryStorage(),
        storageKey: "test:site:2",
      }),
    );
    await waitFor(() => expect(result.current.state).toBe("locked"));
    expect(result.current.locked).toBe(true);

    await expect(
      act(() => result.current.unlock("a guess")),
    ).rejects.toBeInstanceOf(WrongPasswordError);
    expect(result.current.state).toBe("locked");

    await act(() => result.current.unlock("their passphrase"));
    expect(result.current.state).toBe("ready");
    expect((await result.current.adapter!.load())?.text).toBe("doc");
  });

  it("starts ready on a device that remembers the passphrase", async () => {
    const storageKey = freshKey();
    const inner = backend(await encryptText("doc", "pw pw pw pw"));
    const { result } = renderHook(() =>
      useEncryption({
        adapter: inner,
        policy: "required",
        remember: "device",
        storage: memoryStorage({ [`${storageKey}:passphrase`]: "pw pw pw pw" }),
        storageKey,
      }),
    );
    expect(result.current.state).toBe("ready");
    expect((await result.current.adapter!.load())?.text).toBe("doc");
  });

  it("drops to `changed` when the passphrase stops opening it", async () => {
    const storageKey = freshKey();
    const storage = memoryStorage({
      [`${storageKey}:passphrase`]: "old passphrase",
    });
    const inner = backend(await encryptText("doc", "new passphrase"));
    const { result } = renderHook(() =>
      useEncryption({
        adapter: inner,
        policy: "required",
        remember: "device",
        storage,
        storageKey,
      }),
    );
    const adapter = result.current.adapter!;
    await act(async () => {
      await expect(adapter.load()).rejects.toBeInstanceOf(WrongPasswordError);
    });
    expect(result.current.state).toBe("changed");
    expect(result.current.adapter).toBeNull();
    expect(storage.map.has(`${storageKey}:passphrase`)).toBe(false);
    await waitFor(() => expect(result.current.state).toBe("changed"));
  });

  it("re-seals the backend under a changed passphrase", async () => {
    const storageKey = freshKey();
    const inner = backend(await encryptText("doc", "first passphrase"));
    const storage = memoryStorage({
      [`${storageKey}:passphrase`]: "first passphrase",
    });
    const { result } = renderHook(() =>
      useEncryption({
        adapter: inner,
        policy: "required",
        remember: "device",
        storage,
        storageKey,
      }),
    );
    await act(() => result.current.changePassphrase("second passphrase"));
    expect(storage.map.get(`${storageKey}:passphrase`)).toBe(
      "second passphrase",
    );
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
      useEncryption({
        adapter: inner,
        policy: "required",
        storage: memoryStorage(),
        storageKey: "test:site:3",
      }),
    );
    await waitFor(() => expect(result.current.state).toBe("unreachable"));
    expect(result.current.error).toBeInstanceOf(TypeError);
  });
});

describe("useEncryption — optional policy", () => {
  it("passes plaintext through while off", async () => {
    const inner = backend();
    const { result } = renderHook(() =>
      useEncryption({
        adapter: inner,
        storage: memoryStorage(),
        storageKey: "test:site:4",
      }),
    );
    expect(result.current.state).toBe("off");
    await result.current.adapter!.save("hello");
    expect(inner.stored!.text).toBe("hello");
  });

  it("turns on, locks like a reload, unlocks, and turns off", async () => {
    const storageKey = freshKey();
    const storage = memoryStorage();
    const inner = backend("my notes");
    const { result } = renderHook(() =>
      useEncryption({ adapter: inner, storage, storageKey }),
    );
    await act(() => result.current.enable("correct horse"));
    expect(result.current.state).toBe("ready");
    expect(storage.map.get(`${storageKey}:mode`)).toBe("encrypted");
    // Session memory: nothing about the passphrase is written down.
    expect(storage.map.has(`${storageKey}:passphrase`)).toBe(false);
    expect(isEncryptedEnvelope(inner.stored!.text)).toBe(true);

    act(() => result.current.lock());
    await waitFor(() => expect(result.current.state).toBe("locked"));
    expect(result.current.adapter).toBeNull();

    await act(() => result.current.unlock("correct horse"));
    expect(result.current.state).toBe("ready");

    const steps: string[] = [];
    await act(() => result.current.disable((s) => steps.push(s)));
    expect(steps).toContain("decrypting");
    expect(result.current.state).toBe("off");
    expect(inner.stored!.text).toBe("my notes");
    expect(storage.map.has(`${storageKey}:mode`)).toBe(false);
  });

  it("adopts encryption turned on from another device and locks", async () => {
    const inner = backend(await encryptText("doc", "elsewhere"));
    const { result } = renderHook(() =>
      useEncryption({
        adapter: inner,
        storage: memoryStorage(),
        storageKey: "test:site:5",
      }),
    );
    expect(result.current.state).toBe("off");
    await act(async () => {
      await expect(result.current.adapter!.load()).rejects.toBeInstanceOf(
        EncryptionLockedError,
      );
    });
    await waitFor(() => expect(result.current.state).toBe("locked"));
    expect(result.current.fromRemote).toBe(true);
    await act(() => result.current.unlock("elsewhere"));
    expect(result.current.state).toBe("ready");
    expect(result.current.fromRemote).toBe(false);
  });

  it("forgets the passphrase and the mode on a disconnect", async () => {
    const storageKey = freshKey();
    const storage = memoryStorage();
    const { result } = renderHook(() =>
      useEncryption({
        adapter: backend(),
        remember: "device",
        storage,
        storageKey,
      }),
    );
    await act(() => result.current.enable("pw pw pw pw"));
    act(() => result.current.forget());
    expect(result.current.state).toBe("off");
    expect(storage.map.size).toBe(0);
  });
});

describe("useRequiredEncryption (deprecated)", () => {
  it("keeps 3.7.0's shape and passphrase key over useEncryption", async () => {
    const inner = backend("plain doc");
    const storage = memoryStorage();
    const { result } = renderHook(() =>
      useRequiredEncryption({
        inner,
        required: true,
        storage,
        storageKey: "legacy:passphrase:dropbox",
      }),
    );
    await waitFor(() => expect(result.current.state).toBe("create"));
    expect(result.current.adapter).toBeNull();
    await act(() => result.current.create("a long passphrase"));
    expect(result.current.state).toBe("ready");
    expect(storage.map.get("legacy:passphrase:dropbox")).toBe(
      "a long passphrase",
    );
    expect(isEncryptedEnvelope(inner.stored!.text)).toBe(true);
  });

  it("passes a backend that does not require encryption straight through", () => {
    const inner = backend();
    const { result } = renderHook(() =>
      useRequiredEncryption({
        inner,
        required: false,
        storage: memoryStorage(),
        storageKey: "legacy:off",
      }),
    );
    expect(result.current.state).toBe("off");
    expect(result.current.adapter).toBe(inner);
  });
});

describe("EncryptionGate", () => {
  it("asks to choose a passphrase in setup, and seals on submit", async () => {
    const inner = backend("doc");
    function Harness() {
      const enc = useEncryption({
        adapter: inner,
        policy: "required",
        storage: memoryStorage(),
        storageKey: "test:site:6",
      });
      return <EncryptionGate encryption={enc} location="the cloud" />;
    }
    render(<Harness />);
    expect(await screen.findByText("Choose a passphrase")).toBeTruthy();
    fireEvent.input(screen.getByPlaceholderText("Passphrase"), {
      target: { value: "long enough one" },
    });
    fireEvent.input(screen.getByPlaceholderText("Repeat the passphrase"), {
      target: { value: "long enough one" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Encrypt" }));
    await waitFor(() =>
      expect(isEncryptedEnvelope(inner.stored!.text)).toBe(true),
    );
    await waitFor(() =>
      expect(screen.queryByText("Choose a passphrase")).toBeNull(),
    );
  });

  it("is a full-screen gate when blocking and locked", async () => {
    const inner = backend(await encryptText("doc", "pw pw pw pw"));
    const storageKey = freshKey();
    function Harness() {
      const enc = useEncryption({
        adapter: inner,
        storage: memoryStorage({ [`${storageKey}:mode`]: "encrypted" }),
        storageKey,
      });
      return (
        <>
          <EncryptionGate encryption={enc} blocking />
          <p>state:{enc.state}</p>
        </>
      );
    }
    render(<Harness />);
    expect(await screen.findByText("Enter your passphrase")).toBeTruthy();
    fireEvent.input(screen.getByPlaceholderText("Passphrase"), {
      target: { value: "pw pw pw pw" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
    expect(await screen.findByText("state:ready")).toBeTruthy();
  });
});

describe("EncryptionSettings", () => {
  it("offers to turn encryption on while off, and nothing without a backend", () => {
    function Harness({ connected }: { connected: boolean }) {
      const enc = useEncryption({
        adapter: connected ? backend() : null,
        storage: memoryStorage(),
        storageKey: "test:site:7",
      });
      return <EncryptionSettings encryption={enc} />;
    }
    const { rerender, container } = render(<Harness connected={false} />);
    expect(container.textContent).toBe("");
    rerender(<Harness connected />);
    expect(screen.getByText("Encryption is off")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Turn on encryption" }),
    ).toBeTruthy();
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
