// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useEffect, useRef, useState } from "react";

import {
  Button,
  CipherGlyph,
  SegmentedControl,
  Section,
  SelectPicker,
  ToggleRow,
} from "@niclaslindstedt/oss-framework/components";
import {
  backoffDelayMs,
  BrowserLocalStorageAdapter,
  ConflictError,
  isRetryableSaveError,
  MAX_TRANSIENT_SAVE_RETRIES,
  type StorageAdapter,
} from "@niclaslindstedt/oss-framework/storage";
import {
  EncryptionGate,
  EncryptionSettings,
  useEncryption,
  type EncryptionLabels,
} from "@niclaslindstedt/oss-framework/encryption";
import {
  LogModal,
  type LogModalEntry,
  LogViewer,
} from "@niclaslindstedt/oss-framework/logging";
import { useStandaloneMobile } from "@niclaslindstedt/oss-framework/pwa";

import { log, logStore } from "../log.ts";
import { useT } from "../i18n/index.ts";
import { LATEST_VERSION } from "../migrations.ts";
import type { AppSettings } from "../useAppSettings.ts";
import {
  CLOUD_PROVIDERS,
  type MockSync,
  type SyncFault,
} from "../useMockSync.ts";
import { KitSections } from "./kit.tsx";
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
  const t = useT();
  const modeOptions = [
    { value: "swipe" as const, label: t("settings.general.optionSwipe") },
    { value: "button" as const, label: t("settings.general.optionButton") },
  ];
  return (
    <div>
      <p className="mb-3 text-xs text-muted">{t("settings.general.intro")}</p>

      <Section title={t("settings.general.languageTitle")}>
        <div className="flex flex-col gap-1">
          <span className="text-sm text-fg-bright">
            {t("settings.general.chooseLanguage")}
          </span>
          <LanguagePicker />
          <p className="text-xs text-muted">
            {t("settings.general.languageHint")}
          </p>
        </div>
      </Section>

      <Section title={t("settings.general.achievementsTitle")}>
        <ToggleRow
          label={t("settings.general.disableAchievements")}
          hint={t("settings.general.disableAchievementsHint")}
          checked={settings.disableAchievements}
          onChange={(next) => update("disableAchievements", next)}
        />
      </Section>

      <Section title={t("settings.general.sidebarTitle")}>
        <div className="flex flex-col gap-1">
          <span className="text-sm text-fg-bright">
            {t("settings.general.openSidebarWith")}
          </span>
          <SegmentedControl
            value={settings.menuMode}
            options={modeOptions}
            onChange={(next) => update("menuMode", next)}
            ariaLabel={t("settings.general.openSidebarWith")}
          />
          <p className="text-xs text-muted">
            {t("settings.general.sidebarHint")}
          </p>
        </div>
      </Section>

      <Section title={t("settings.general.developerTitle")}>
        <ToggleRow
          label={t("settings.general.developerMode")}
          hint={t("settings.general.developerModeHint")}
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
  const t = useT();
  const positionOptions = [
    { value: "top" as const, label: t("settings.editor.optionTop") },
    { value: "bottom" as const, label: t("settings.editor.optionBottom") },
  ];
  return (
    <div>
      <p className="mb-3 text-xs text-muted">{t("settings.editor.intro")}</p>
      <Section title={t("settings.editor.inputTitle")}>
        <ToggleRow
          label={t("settings.editor.spellCheck")}
          hint={t("settings.editor.spellCheckHint")}
          checked={settings.spellCheck}
          onChange={(next) => update("spellCheck", next)}
        />
        <ToggleRow
          label={t("settings.editor.monospace")}
          hint={t("settings.editor.monospaceHint")}
          checked={settings.monospace}
          onChange={(next) => update("monospace", next)}
        />
      </Section>

      <Section title={t("settings.editor.listTitle")}>
        <div className="flex flex-col gap-1">
          <span className="text-sm text-fg-bright">
            {t("settings.editor.addItemPosition")}
          </span>
          <SegmentedControl
            value={settings.addItemPosition}
            options={positionOptions}
            onChange={(next) => update("addItemPosition", next)}
            ariaLabel={t("settings.editor.addItemPosition")}
          />
          <p className="text-xs text-muted">
            {t("settings.editor.addItemPositionHint")}
          </p>
        </div>
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

// How many transient save failures the "flaky backend" toggle injects before a
// save succeeds. Kept below MAX_TRANSIENT_SAVE_RETRIES so the framework's retry
// policy always recovers — the point is to show the backoff curve working, not
// the give-up path.
const FLAKY_FAILURES = 3;

// A snappier backoff than the production default (baseMs 500 → up to ~30s) so
// the playground's retries read in a second or two rather than stalling.
const DEMO_BACKOFF = { baseMs: 250, factor: 2, maxMs: 1500 };

// Diagnostics for the retry path route into the same in-app buffer the Logs tab
// renders, alongside the `encrypt` scope.
const saveLog = logStore.createLogger("save");

// Diagnostics for encrypt/decrypt route into the same buffer, dogfooding the
// storage `Logger` seam.
const encryptLog = logStore.createLogger("encrypt");

export function StorageTab({ sync }: { sync: MockSync }) {
  const t = useT();
  // The raw browser backend. Everything about encryption — turning it on and
  // off, the lock a reload leaves behind, unlocking, changing the passphrase —
  // is the framework's `useEncryption`; the playground only owns the document
  // and what it does with the adapter the hook hands back (null while locked).
  const [inner] = useState<StorageAdapter>(
    () => new BrowserLocalStorageAdapter({ key: STORAGE_DOC_KEY }),
  );
  const enc = useEncryption({
    adapter: inner,
    storageKey: "oss-demo:encryption",
    logger: encryptLog,
  });
  const adapter = enc.adapter;
  const locked = adapter === null;
  const encLabels: EncryptionLabels = {
    on: t("settings.storage.encryptedUnlocked"),
    hint: t("settings.storage.encryptDocumentHint"),
    enable: t("settings.storage.encryptDocument"),
    lock: t("settings.storage.lock"),
    passphrase: t("settings.storage.passphrase"),
    unlock: t("settings.storage.unlock"),
    createSubmit: t("settings.storage.encrypt"),
    unlockTitle: t("settings.storage.gateTitle"),
    unlockHint: t("settings.storage.gateHint"),
    wrong: t("settings.storage.gateWrong"),
    statusAria: t("settings.storage.gateStatusAria"),
    steps: {
      derivingKey: t("settings.storage.gateDeriving"),
      decrypting: t("settings.storage.gateDecrypting"),
    },
  };

  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState<null | "writing" | "reading">(null);
  const baseRevision = useRef<string | undefined>(undefined);

  const [rawBytes, setRawBytes] = useState<string | null>(null);

  // "Flaky backend" simulation: when on, the next save injects FLAKY_FAILURES
  // transient errors before the real write lands, exercising the framework's
  // `backoffDelayMs` + `isRetryableSaveError` + `MAX_TRANSIENT_SAVE_RETRIES`
  // retry policy. A real cloud backend on a poor link does this for real; the
  // toggle reproduces it on the synchronous browser backend.
  const [flaky, setFlaky] = useState(false);
  const pendingFailures = useRef(0);

  // The step-by-step trace of the *last* save operation, scoped to that one
  // run. The global Logs tab mixes every scope together; this is the focused
  // view the framework's `LogModal` renders — opened from the status line when a
  // save took retries or failed, so the user can read exactly what that one
  // operation did without scrolling the whole buffer.
  const [opLog, setOpLog] = useState<LogModalEntry[]>([]);
  const [opLogOpen, setOpLogOpen] = useState(false);

  // The app-owned save engine: thread the document through the encrypting
  // adapter, but first drain any injected transient failures. This is the seam
  // the framework deliberately leaves in the app — the policy is shared, the
  // setTimeout/queue plumbing is yours.
  const saveViaBackend = useCallback(
    async (txt: string, rev: string | undefined) => {
      if (pendingFailures.current > 0) {
        pendingFailures.current -= 1;
        throw new Error("simulated transient backend failure (HTTP 5xx)");
      }
      if (!adapter) throw new Error("locked — unlock to save");
      return adapter.save(txt, rev);
    },
    [adapter],
  );

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
        if (!adapter) {
          setText("");
          setStatus("locked — only the envelope remains");
          return;
        }
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
    if (flaky) pendingFailures.current = FLAKY_FAILURES;
    // Build the operation's own trace as it runs. Each line goes to both the
    // global buffer (the `save` scope, via saveLog) and this scoped array, so
    // the LogModal shows exactly this one save's steps. setOpLog runs on every
    // push so a modal opened mid-flight stays live.
    const op: LogModalEntry[] = [];
    const note = (level: LogModalEntry["level"], text: string) => {
      op.push({ ts: Date.now(), level, text });
      setOpLog([...op]);
    };
    note("info", "save started");
    await withBusy("writing", async () => {
      // The retry loop a real save queue runs: try the write, and on a
      // retryable failure within budget, wait out the framework's backoff curve
      // and try again. Typed signals (conflict) and the budget ceiling break
      // out to dedicated handling / a hard error.
      for (let attempt = 0; ;) {
        try {
          const saved = await saveViaBackend(text, baseRevision.current);
          baseRevision.current = saved.revision;
          const msg =
            attempt > 0
              ? `saved after ${attempt} ${attempt === 1 ? "retry" : "retries"} — it persists`
              : "saved — reload the page, it persists";
          note("info", msg);
          setStatus(msg);
          return;
        } catch (err) {
          if (err instanceof ConflictError) {
            setText(err.remote.text);
            baseRevision.current = err.remote.revision;
            const msg = "ConflictError — adopted the other tab's bytes";
            note("warn", msg);
            setStatus(msg);
            return;
          }
          if (
            isRetryableSaveError(err) &&
            attempt < MAX_TRANSIENT_SAVE_RETRIES
          ) {
            const delay = backoffDelayMs(attempt, DEMO_BACKOFF);
            const next = attempt + 1;
            const line = `save failed (${err instanceof Error ? err.message : String(err)}) — retry ${next}/${MAX_TRANSIENT_SAVE_RETRIES} in ${delay}ms`;
            saveLog.warn(line);
            note("warn", line);
            setStatus(
              `transient failure — retrying in ${delay}ms (${next}/${MAX_TRANSIENT_SAVE_RETRIES})`,
            );
            await settle(delay);
            attempt = next;
            continue;
          }
          const msg = err instanceof Error ? err.message : String(err);
          note("error", msg);
          setStatus(msg);
          return;
        }
      }
    });
  }

  return (
    <div>
      <p className="mb-3 text-xs text-muted">
        A live playground over the framework's <code>StorageAdapter</code>{" "}
        contract (the browser backend), optionally wrapped with the framework's{" "}
        <code>useEncryption</code> so the bytes on disk are an AES-GCM envelope.
        Save persists across reloads; a second tab saving meanwhile surfaces a{" "}
        <code>ConflictError</code>. While a read or write is in flight the
        framework's <code>CipherGlyph</code> stands in for a spinner. Flip{" "}
        <em>Simulate a flaky backend</em> to inject transient failures and watch
        the framework's retry policy ride the backoff curve until the write
        lands (the attempts log under the <code>save</code> scope).
      </p>
      <Section title={t("settings.storage.documentTitle")}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          spellCheck={false}
          disabled={locked}
          placeholder={t("settings.storage.docPlaceholder")}
          className="w-full resize-y rounded-md border border-line bg-surface-2 p-2 font-mono text-sm text-fg outline-none focus:border-accent disabled:opacity-50"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            onClick={save}
            disabled={busy !== null || locked}
          >
            {t("common.save")}
          </Button>
          <Button
            variant="secondary"
            onClick={() => void reload()}
            disabled={busy !== null || locked}
          >
            {t("settings.storage.reload")}
          </Button>
          {busy ? (
            <span className="flex items-center gap-2 text-sm text-accent">
              <CipherGlyph />
              {busy === "writing"
                ? t("settings.storage.enciphering")
                : t("settings.storage.reading")}
            </span>
          ) : (
            status && <span className="text-sm text-success">{status}</span>
          )}
          {/* The status line above only shows the final outcome. When the save
              took retries or failed, surface its full per-step trace through the
              framework's LogModal — the focused, one-operation counterpart to
              the global Logs tab. */}
          {!busy && opLog.some((e) => e.level !== "info") && (
            <Button variant="ghost" onClick={() => setOpLogOpen(true)}>
              {t("settings.storage.viewSaveLog")}
            </Button>
          )}
        </div>
        <ToggleRow
          label={t("settings.storage.flakyBackend")}
          hint={t("settings.storage.flakyBackendHint")}
          checked={flaky}
          onChange={setFlaky}
        />
      </Section>

      <Section title={t("settings.storage.encryptionTitle")}>
        {/* The whole settings block is the framework's: on/off, lock,
            change the passphrase, with the phases on a CipherGlyph line. */}
        <EncryptionSettings
          encryption={enc}
          location={t("settings.storage.thisBrowser")}
          labels={encLabels}
          onChanged={() => void reload()}
        />
      </Section>

      <Section title={t("settings.storage.bytesTitle")}>
        <p className="text-xs text-muted">{t("settings.storage.bytesIntro")}</p>
        <div>
          <Button variant="secondary" onClick={refreshRaw}>
            {rawBytes === null
              ? t("settings.storage.showStoredBytes")
              : t("settings.storage.refresh")}
          </Button>
        </div>
        {rawBytes !== null && (
          <pre className="max-h-40 overflow-auto rounded-md border border-line bg-surface-2 p-2 font-mono text-xs break-all whitespace-pre-wrap text-muted">
            {rawBytes || "(nothing stored yet)"}
          </pre>
        )}
      </Section>

      {/* Where the *document* lives — the backend the header's `SyncStatus`
          glyph and the `SyncDetailsModal` command centre report on. The cloud
          is simulated (see `useMockSync`); these controls apply live. */}
      <Section title={t("settings.storage.cloudSyncTitle")}>
        <p className="text-xs text-muted">
          {t("settings.storage.cloudSyncHint")}
        </p>
        <SegmentedControl
          value={sync.backend}
          onChange={sync.setBackend}
          options={[
            { value: "local", label: t("settings.storage.backendThisDevice") },
            { value: "cloud", label: t("settings.storage.backendCloud") },
          ]}
        />
        {/* Which cloud drive backs the document. Realistic local-first apps
            offer a long, flat menu of providers — the natural home for the
            framework's type-ahead `SelectPicker`: open it and type "one" to
            jump to OneDrive. The pick flows straight into the header
            `SyncStatus` glyph ("synced to …") and the command centre's folder
            path. Only meaningful on the cloud backend. */}
        {sync.backend === "cloud" && (
          <div className="flex flex-col gap-1">
            <span className="text-sm text-fg-bright">
              {t("settings.storage.cloudProviderTitle")}
            </span>
            <SelectPicker
              value={sync.providerId}
              onChange={sync.setProviderId}
              ariaLabel={t("settings.storage.cloudProviderTitle")}
              panelClassName="max-h-64 overflow-y-auto"
              options={CLOUD_PROVIDERS.map((p) => ({
                value: p.id,
                label: p.name,
                hint: `${p.folder}/…`,
              }))}
            />
            <p className="text-xs text-muted">
              {t("settings.storage.cloudProviderHint")}
            </p>
          </div>
        )}
        <ToggleRow
          label={t("settings.storage.encryptSync")}
          hint={t("settings.storage.encryptSyncHint")}
          checked={sync.encrypted}
          onChange={sync.setEncrypted}
        />
      </Section>

      <LogModal
        open={opLogOpen}
        entries={opLog}
        onClose={() => setOpLogOpen(false)}
        labels={{
          title: t("settings.storage.saveLogTitle"),
          empty: t("settings.storage.saveLogEmpty"),
          close: t("common.close"),
        }}
      />

      {/* Asks whenever the hook needs an answer. `blocking`: the document is
          the whole app here, so a locked one is the full-screen gate — what a
          real app paints on a fresh load, and after "Lock". */}
      <EncryptionGate
        encryption={enc}
        location={t("settings.storage.thisBrowser")}
        labels={encLabels}
        blocking
      />
    </div>
  );
}

// --- Developer -------------------------------------------------------------

export function DeveloperTab({
  settings,
  update,
  sync,
  onSimulateUpdate,
  onLoadLegacy,
}: {
  settings: AppSettings;
  update: Update;
  // The simulated sync engine — its fault injectors live here.
  sync: MockSync;
  onSimulateUpdate: () => void;
  // Replace the active document with a genuine pre-versioning file, so the
  // migration runner upgrades it live (Developer tab → Document migrations).
  onLoadLegacy: () => void;
}) {
  const t = useT();
  // Real install context, read from the framework's PWA detection. `true` only
  // with no browser chrome on a phone/tablet — an installed PWA window or a
  // native shell's WebView; a normal tab is `false`.
  const standalone = useStandaloneMobile();
  return (
    <div>
      <p className="mb-3 text-xs text-muted">{t("settings.developer.intro")}</p>
      <Section title={t("settings.developer.loggingTitle")}>
        <ToggleRow
          label={t("settings.developer.captureLogs")}
          hint={t("settings.developer.captureLogsHint")}
          checked={settings.captureLogs}
          onChange={(next) => update("captureLogs", next)}
        />
        <Button
          variant="secondary"
          className="self-start"
          onClick={() => log.info("Test log line from the Developer tab")}
        >
          {t("settings.developer.writeTestLine")}
        </Button>
      </Section>
      <Section title={t("settings.developer.updatesTitle")}>
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
          {t("settings.developer.simulateUpdate")}
        </Button>
      </Section>
      <Section title={t("settings.developer.syncFaultsTitle")}>
        <p className="text-xs text-muted">
          {t("settings.developer.syncFaultsIntro")}
        </p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["offline", t("settings.developer.faultOffline")],
              ["auth-error", t("settings.developer.faultAuth")],
              ["conflict", t("settings.developer.faultConflict")],
              ["throttled", t("settings.developer.faultThrottle")],
            ] as [SyncFault, string][]
          ).map(([fault, label]) => (
            <Button
              key={fault}
              variant={sync.fault === fault ? "primary" : "secondary"}
              disabled={sync.backend !== "cloud"}
              onClick={() => sync.setFault(fault)}
            >
              {label}
            </Button>
          ))}
          <Button
            variant="secondary"
            disabled={sync.backend !== "cloud" || sync.fault === "none"}
            onClick={() => sync.setFault("none")}
          >
            {t("settings.developer.faultClear")}
          </Button>
        </div>
      </Section>
      <Section title={t("settings.developer.migrationsTitle")}>
        <p className="text-xs text-muted">
          {t("settings.developer.migrationsIntro")}
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted">
            {t("settings.developer.latestVersionLabel")}
          </dt>
          <dd className="text-fg tabular-nums">v{LATEST_VERSION}</dd>
        </dl>
        <Button
          variant="secondary"
          className="self-start"
          onClick={onLoadLegacy}
        >
          {t("settings.developer.loadLegacy")}
        </Button>
      </Section>
      <KitSections />
      <Section title={t("settings.developer.buildTitle")}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted">framework</dt>
          <dd className="text-fg tabular-nums">
            @niclaslindstedt/oss-framework
          </dd>
          <dt className="text-muted">{t("settings.developer.buildLabel")}</dt>
          <dd className="text-fg tabular-nums">{__BUILD_NUMBER__}</dd>
          <dt className="text-muted">{t("settings.developer.commitLabel")}</dt>
          <dd className="text-fg tabular-nums">{__BUILD_COMMIT__}</dd>
          <dt className="text-muted">{t("settings.developer.modeLabel")}</dt>
          <dd className="text-fg">{import.meta.env.MODE}</dd>
          <dt className="text-muted">{t("settings.developer.displayLabel")}</dt>
          <dd className="text-fg">
            {standalone
              ? t("settings.developer.installedPwa")
              : t("settings.developer.browserTab")}
          </dd>
        </dl>
      </Section>
    </div>
  );
}

// --- Logs ------------------------------------------------------------------

export function LogsTab() {
  const t = useT();
  return (
    <div>
      <p className="mb-3 text-xs text-muted">{t("settings.logs.intro")}</p>
      <Section title={t("settings.logs.logsTitle")}>
        <LogViewer store={logStore} />
      </Section>
    </div>
  );
}
