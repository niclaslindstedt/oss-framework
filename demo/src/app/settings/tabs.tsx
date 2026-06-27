// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  Button,
  CipherGlyph,
  SegmentedControl,
  Section,
  ToggleRow,
} from "@niclaslindstedt/oss-framework/components";
import {
  BrowserLocalStorageAdapter,
  ConflictError,
  type StorageAdapter,
} from "@niclaslindstedt/oss-framework/storage";
import {
  type PasswordRef,
  withEncryption,
} from "@niclaslindstedt/oss-framework/encryption";
import { LogViewer } from "@niclaslindstedt/oss-framework/logging";
import { useStandaloneMobile } from "@niclaslindstedt/oss-framework/pwa";

import { log, logStore } from "../log.ts";
import type { AppSettings } from "../useAppSettings.ts";
import { LanguagePicker } from "./shared.tsx";

type Update = <K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K],
) => void;

// --- General ---------------------------------------------------------------

export function GeneralTab({
  settings,
  update,
}: {
  settings: AppSettings;
  update: Update;
}) {
  return (
    <div>
      <p className="mb-3 text-xs text-muted">
        General preferences for this device.
      </p>

      <Section title="Language">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-fg-bright">Choose language</span>
          <LanguagePicker
            value={settings.language}
            onChange={(next) => {
              update("language", next);
              log.info(`Language set to ${next}`);
            }}
          />
          <p className="text-xs text-muted">
            Translate the UI between English and Swedish.
          </p>
        </div>
      </Section>

      <Section title="Achievements">
        <ToggleRow
          label="Disable achievements"
          hint="Stop tracking achievements and hide the trophy button. Achievements you've already earned are kept."
          checked={settings.disableAchievements}
          onChange={(next) => update("disableAchievements", next)}
        />
      </Section>

      <Section title="Sidebar">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-fg-bright">Open sidebar with</span>
          <SegmentedControl
            value={settings.menuMode}
            options={[
              { value: "swipe", label: "Right-swipe" },
              { value: "button", label: "Floating button" },
            ]}
            onChange={(next) => update("menuMode", next)}
            ariaLabel="Open sidebar with"
          />
          <p className="text-xs text-muted">
            Choose how to open the sidebar on this device — tap the floating
            button, or swipe in from the edge of the screen. Settings lives in
            the sidebar's footer.
          </p>
        </div>
      </Section>

      <Section title="Developer">
        <ToggleRow
          label="Developer mode"
          hint="Reveal the Developer tab with diagnostic tools. Stays on this device."
          checked={settings.devMode}
          onChange={(next) => update("devMode", next)}
        />
      </Section>
    </div>
  );
}

// --- Editor ----------------------------------------------------------------

export function EditorTab({
  settings,
  update,
}: {
  settings: AppSettings;
  update: Update;
}) {
  return (
    <div>
      <p className="mb-3 text-xs text-muted">
        How item text behaves as you type.
      </p>
      <Section title="Input">
        <ToggleRow
          label="Spell check"
          hint="Underline misspelled words while editing an item."
          checked={settings.spellCheck}
          onChange={(next) => update("spellCheck", next)}
        />
        <ToggleRow
          label="Monospace items"
          hint="Render item text in the monospace UI font."
          checked={settings.monospace}
          onChange={(next) => update("monospace", next)}
        />
      </Section>
    </div>
  );
}

// --- Storage ---------------------------------------------------------------

const STORAGE_DOC_KEY = "oss-demo:checklist:storage-playground";

// A spinner-style minimum display so the busy indicator is legible even when
// the (synchronous) browser backend resolves in well under a frame.
const BUSY_MIN_MS = 650;
const settle = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Encryption lifecycle, mirroring a real app's: the document is plaintext, or
// being set up with a fresh passphrase (`setup`), or an envelope we can read
// (`unlocked`), or an envelope we can't because the session passphrase is gone
// after a (simulated) reload (`locked`).
type EncMode = "plaintext" | "setup" | "unlocked" | "locked";

const inputClass =
  "rounded-md border border-line bg-surface-2 px-2 py-1 font-mono text-sm text-fg outline-none focus:border-accent";

export function StorageTab() {
  // The raw browser backend, and a passphrase ref the encrypting wrapper reads
  // fresh on every op — the seam a real app owns: the framework holds the
  // passphrase nowhere, the app threads it in by reference.
  const [inner] = useState<StorageAdapter>(
    () => new BrowserLocalStorageAdapter({ key: STORAGE_DOC_KEY }),
  );
  const passwordRef = useRef<PasswordRef["current"]>(null);
  const adapter = useMemo(
    () =>
      withEncryption(inner, passwordRef, {
        // Route the wrapper's encrypt/decrypt diagnostics into the same in-app
        // buffer the Logs tab renders — dogfooding the storage `Logger` seam.
        logger: logStore.createLogger("encrypt"),
      }),
    [inner],
  );

  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState<null | "writing" | "reading">(null);
  const baseRevision = useRef<string | undefined>(undefined);

  const [mode, setMode] = useState<EncMode>("plaintext");
  const [pass, setPass] = useState("");
  const [encError, setEncError] = useState("");
  const [rawBytes, setRawBytes] = useState<string | null>(null);

  const refreshRaw = useCallback(() => {
    setRawBytes(localStorage.getItem(STORAGE_DOC_KEY));
  }, []);

  // Run an async storage op behind the cipher indicator, holding it on screen
  // for at least BUSY_MIN_MS so the enciphering animation reads rather than
  // flickering past — the same anti-flicker beat a real loading spinner uses.
  // (With encryption on, the 600k-iteration key derivation is a genuinely slow
  // op the indicator now fronts for real, not just for show.)
  const withBusy = useCallback(
    async (kind: "writing" | "reading", op: () => Promise<void>) => {
      setBusy(kind);
      try {
        await Promise.all([op(), settle(BUSY_MIN_MS)]);
      } finally {
        setBusy(null);
        refreshRaw();
      }
    },
    [refreshRaw],
  );

  const reload = useCallback(
    () =>
      withBusy("reading", async () => {
        const snap = await adapter.load();
        setText(snap?.text ?? "");
        baseRevision.current = snap?.revision;
        setStatus(snap ? `loaded ${snap.text.length} B` : "nothing stored yet");
      }),
    [adapter, withBusy],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  async function save() {
    await withBusy("writing", async () => {
      try {
        const saved = await adapter.save(text, baseRevision.current);
        baseRevision.current = saved.revision;
        setStatus("saved — reload the page, it persists");
      } catch (err) {
        if (err instanceof ConflictError) {
          setText(err.remote.text);
          baseRevision.current = err.remote.revision;
          setStatus("ConflictError — adopted the other tab's bytes");
        } else {
          setStatus(err instanceof Error ? err.message : String(err));
        }
      }
    });
  }

  // Turn encryption on with the entered passphrase, then re-save so the bytes
  // on disk become an envelope.
  async function enableEncryption() {
    if (!pass) return;
    passwordRef.current = pass;
    setMode("unlocked");
    setPass("");
    setEncError("");
    await save();
  }

  // Turn encryption off and re-save plaintext.
  async function disableEncryption() {
    passwordRef.current = null;
    setMode("plaintext");
    setEncError("");
    await save();
  }

  // Simulate a reload: the session passphrase is in memory only, so dropping it
  // leaves the envelope on disk unreadable until the user re-enters it.
  function lock() {
    passwordRef.current = null;
    setMode("locked");
    setText("");
    setStatus("locked — the passphrase is gone, only the envelope remains");
    refreshRaw();
  }

  // Re-enter the passphrase and decrypt. A wrong one fails at the AES-GCM auth
  // tag, surfaced here as the framework's "Wrong password".
  async function unlock() {
    if (!pass) return;
    passwordRef.current = pass;
    setEncError("");
    try {
      await reload();
      setMode("unlocked");
      setPass("");
    } catch (err) {
      passwordRef.current = null;
      setEncError(err instanceof Error ? err.message : String(err));
    }
  }

  const locked = mode === "locked";
  const passControls = mode === "setup" || locked;

  return (
    <div>
      <p className="mb-3 text-xs text-muted">
        A live playground over the framework's <code>StorageAdapter</code>{" "}
        contract (the browser backend), optionally wrapped with{" "}
        <code>withEncryption</code> so the bytes on disk are an AES-GCM
        envelope. Save persists across reloads; a second tab saving meanwhile
        surfaces a <code>ConflictError</code>. While a read or write is in
        flight the framework's <code>CipherGlyph</code> stands in for a spinner.
      </p>
      <Section title="Document">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          spellCheck={false}
          disabled={locked}
          placeholder="Type a document, then Save. Reload the page — it persists."
          className="w-full resize-y rounded-md border border-line bg-surface-2 p-2 font-mono text-sm text-fg outline-none focus:border-accent disabled:opacity-50"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            onClick={save}
            disabled={busy !== null || locked}
          >
            Save
          </Button>
          <Button
            variant="secondary"
            onClick={() => void reload()}
            disabled={busy !== null || locked}
          >
            Reload
          </Button>
          {busy ? (
            <span className="flex items-center gap-2 text-sm text-accent">
              <CipherGlyph />
              {busy === "writing" ? "enciphering…" : "reading…"}
            </span>
          ) : (
            status && <span className="text-sm text-success">{status}</span>
          )}
        </div>
      </Section>

      <Section title="Encryption at rest">
        <ToggleRow
          label="Encrypt this document"
          hint="Wrap the backend with withEncryption — bytes on disk become an AES-GCM envelope keyed by your passphrase."
          checked={mode !== "plaintext"}
          onChange={(next) => {
            setEncError("");
            if (next) {
              if (mode === "plaintext") setMode("setup");
            } else if (mode === "setup") {
              setMode("plaintext"); // cancel — nothing was written
            } else if (mode === "unlocked") {
              void disableEncryption();
            } else {
              // Locked: can't re-save plaintext without first decrypting.
              setEncError("Unlock first to turn encryption off.");
            }
          }}
        />

        {mode === "unlocked" && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-success">
              Encrypted &amp; unlocked — saves encipher, loads decrypt.
            </span>
            <Button variant="secondary" onClick={lock}>
              Lock (simulate reload)
            </Button>
          </div>
        )}

        {passControls && (
          <div className="flex flex-col gap-2">
            <span className="text-xs text-muted">
              {mode === "setup"
                ? "Choose a passphrase. Saving re-writes the document as an envelope; the passphrase is held in memory only."
                : "The passphrase lives only in memory, so a reload locks the document. Enter it to decrypt the envelope on disk."}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  void (locked ? unlock() : enableEncryption())
                }
                placeholder="Passphrase"
                className={inputClass}
              />
              <Button
                variant="primary"
                onClick={() => void (locked ? unlock() : enableEncryption())}
                disabled={!pass || busy !== null}
              >
                {locked ? "Unlock" : "Encrypt"}
              </Button>
            </div>
            {encError && (
              <span className="text-sm text-danger">{encError}</span>
            )}
          </div>
        )}
      </Section>

      <Section title="Bytes on disk">
        <p className="text-xs text-muted">
          What <code>localStorage</code> actually holds for this document —
          plaintext, or the JSON envelope when encrypted.
        </p>
        <div>
          <Button variant="secondary" onClick={refreshRaw}>
            {rawBytes === null ? "Show stored bytes" : "Refresh"}
          </Button>
        </div>
        {rawBytes !== null && (
          <pre className="max-h-40 overflow-auto rounded-md border border-line bg-surface-2 p-2 font-mono text-xs break-all whitespace-pre-wrap text-muted">
            {rawBytes || "(nothing stored yet)"}
          </pre>
        )}
      </Section>
    </div>
  );
}

// --- Developer -------------------------------------------------------------

export function DeveloperTab({
  settings,
  update,
  onSimulateUpdate,
}: {
  settings: AppSettings;
  update: Update;
  onSimulateUpdate: () => void;
}) {
  // Real install context, read from the framework's PWA detection. `true` only
  // inside an installed PWA window on a phone/tablet — a normal tab is `false`.
  const standalone = useStandaloneMobile();
  return (
    <div>
      <p className="mb-3 text-xs text-muted">
        Diagnostic tools. These stay on this device.
      </p>
      <Section title="Logging">
        <ToggleRow
          label="Capture logs"
          hint="Record diagnostic log lines so the Logs tab can show them."
          checked={settings.captureLogs}
          onChange={(next) => update("captureLogs", next)}
        />
        <Button
          variant="secondary"
          className="self-start"
          onClick={() => log.info("Test log line from the Developer tab")}
        >
          Write a test log line
        </Button>
      </Section>
      <Section title="Software updates">
        <p className="text-xs text-muted">
          An installed PWA drives the framework's <code>UpdateToast</code> from{" "}
          <code>usePwaUpdate()</code> — its service worker reaching the{" "}
          <code>waiting</code> state. This demo has no service worker, so
          trigger the prompt here to see it slide up at the bottom of the
          screen.
        </p>
        <Button
          variant="secondary"
          className="self-start"
          onClick={onSimulateUpdate}
        >
          Simulate an available update
        </Button>
      </Section>
      <Section title="Build">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted">framework</dt>
          <dd className="text-fg tabular-nums">
            @niclaslindstedt/oss-framework
          </dd>
          <dt className="text-muted">mode</dt>
          <dd className="text-fg">{import.meta.env.MODE}</dd>
          <dt className="text-muted">display</dt>
          <dd className="text-fg">
            {standalone ? "installed PWA (standalone)" : "browser tab"}
          </dd>
        </dl>
      </Section>
    </div>
  );
}

// --- Logs ------------------------------------------------------------------

export function LogsTab() {
  return (
    <div>
      <p className="mb-3 text-xs text-muted">
        The in-app log buffer, rendered live from the framework's logging
        module.
      </p>
      <Section title="Logs">
        <LogViewer store={logStore} />
      </Section>
    </div>
  );
}
