// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useEffect, useRef, useState } from "react";

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
import { LogViewer } from "@niclaslindstedt/oss-framework/logging";

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

      <Section title="Menu">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-fg-bright">Open the menu with</span>
          <SegmentedControl
            value={settings.menuMode}
            options={[
              { value: "swipe", label: "Right-swipe" },
              { value: "button", label: "Floating button" },
            ]}
            onChange={(next) => update("menuMode", next)}
            ariaLabel="Open the menu with"
          />
          <p className="text-xs text-muted">
            Choose how to open the side menu on this device — tap the floating
            button, or swipe in from the edge of the screen.
          </p>
        </div>
      </Section>

      <Section title="Settings">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-fg-bright">Open settings with</span>
          <SegmentedControl
            value={settings.settingsMode}
            options={[
              { value: "swipe", label: "Right-swipe" },
              { value: "button", label: "Floating button" },
            ]}
            onChange={(next) => update("settingsMode", next)}
            ariaLabel="Open settings with"
          />
          <p className="text-xs text-muted">
            Choose how to open Settings on this device — tap the floating
            settings button, or swipe in from the edge it rests on.
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

export function StorageTab() {
  const [adapter] = useState<StorageAdapter>(
    () => new BrowserLocalStorageAdapter({ key: STORAGE_DOC_KEY }),
  );
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState<null | "writing" | "reading">(null);
  const baseRevision = useRef<string | undefined>(undefined);

  // Run an async storage op behind the cipher indicator, holding it on screen
  // for at least BUSY_MIN_MS so the enciphering animation reads rather than
  // flickering past — the same anti-flicker beat a real loading spinner uses.
  const withBusy = useCallback(
    async (kind: "writing" | "reading", op: () => Promise<void>) => {
      setBusy(kind);
      try {
        await Promise.all([op(), settle(BUSY_MIN_MS)]);
      } finally {
        setBusy(null);
      }
    },
    [],
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

  return (
    <div>
      <p className="mb-3 text-xs text-muted">
        A live playground over the framework's <code>StorageAdapter</code>{" "}
        contract (the browser backend). Save persists across reloads; a second
        tab saving meanwhile surfaces a <code>ConflictError</code>. While a read
        or write is in flight the framework's <code>CipherGlyph</code> stands in
        for a spinner.
      </p>
      <Section title="Document">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          spellCheck={false}
          placeholder="Type a document, then Save. Reload the page — it persists."
          className="w-full resize-y rounded-md border border-line bg-surface-2 p-2 font-mono text-sm text-fg outline-none focus:border-accent"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={save} disabled={busy !== null}>
            Save
          </Button>
          <Button
            variant="secondary"
            onClick={() => void reload()}
            disabled={busy !== null}
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
    </div>
  );
}

// --- Developer -------------------------------------------------------------

export function DeveloperTab({
  settings,
  update,
}: {
  settings: AppSettings;
  update: Update;
}) {
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
      <Section title="Build">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted">framework</dt>
          <dd className="text-fg tabular-nums">
            @niclaslindstedt/oss-framework
          </dd>
          <dt className="text-muted">mode</dt>
          <dd className="text-fg">{import.meta.env.MODE}</dd>
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
