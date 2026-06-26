// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useEffect, useRef, useState } from "react";

import {
  BrowserLocalStorageAdapter,
  ConflictError,
  createFolderAdapter,
  isFolderBackendAvailable,
  type AdapterCapability,
  type StorageAdapter,
  type StoredSnapshot,
} from "@niclaslindstedt/oss-framework/storage";

// Demonstrates the storage module's core promise: one `StorageAdapter` byte
// contract that the same UI drives, whichever backend is behind it. The live
// playground runs against the browser (localStorage) backend — and, in a
// Chromium browser, a real local folder you pick — so save / load / conflict /
// capabilities are all exercised for real. The cloud backends need an app's own
// OAuth credentials, so those are shown as copy-paste wiring snippets rather
// than run live.

const DOC_KEY = "oss-demo:storage:document";
const FOLDER_FILE = "oss-demo.json";

type BackendId = "browser" | "folder";

export function StorageDemo() {
  const [backend, setBackend] = useState<BackendId>("browser");
  const [adapter, setAdapter] = useState<StorageAdapter>(
    () => new BrowserLocalStorageAdapter({ key: DOC_KEY }),
  );
  const [text, setText] = useState("");
  const [snapshot, setSnapshot] = useState<StoredSnapshot | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle", message: "" });
  // The revision the editor's text is based on — handed back on `save` so the
  // adapter can detect a remote that moved underneath us (optimistic locking).
  const baseRevision = useRef<string | undefined>(undefined);

  const reload = useCallback(async (a: StorageAdapter) => {
    // The browser backend can answer synchronously (no empty-state flash);
    // cloud/folder backends only have the async path.
    const sync = a.loadSync?.();
    if (sync) {
      setText(sync.text);
      baseRevision.current = sync.revision;
    }
    try {
      const snap = await a.load();
      setSnapshot(snap);
      setText(snap?.text ?? "");
      baseRevision.current = snap?.revision;
      setStatus({
        kind: "ok",
        message: snap ? `loaded ${snap.text.length} B` : "nothing stored yet",
      });
    } catch (err) {
      setStatus({ kind: "err", message: describe(err) });
    }
  }, []);

  useEffect(() => {
    void reload(adapter);
  }, [adapter, reload]);

  async function save() {
    try {
      const saved = await adapter.save(text, baseRevision.current);
      baseRevision.current = saved.revision;
      setSnapshot(saved);
      setStatus({ kind: "ok", message: "saved" });
    } catch (err) {
      if (err instanceof ConflictError) {
        setStatus({
          kind: "err",
          message: "ConflictError — the remote moved; its bytes are now loaded",
        });
        // The error carries the newer remote snapshot — adopt it so the next
        // save is based on the right revision (a real app would offer a merge).
        setText(err.remote.text);
        baseRevision.current = err.remote.revision;
        setSnapshot(err.remote);
      } else {
        setStatus({ kind: "err", message: describe(err) });
      }
    }
  }

  async function connectFolder() {
    try {
      const handle = await window.showDirectoryPicker!();
      const folderAdapter = createFolderAdapter(handle, {
        fileName: FOLDER_FILE,
      });
      setBackend("folder");
      setAdapter(folderAdapter);
    } catch (err) {
      // AbortError = the user dismissed the picker; anything else is real.
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setStatus({ kind: "err", message: describe(err) });
      }
    }
  }

  function useBrowser() {
    setBackend("browser");
    setAdapter(new BrowserLocalStorageAdapter({ key: DOC_KEY }));
  }

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-bold text-fg-bright">Storage</h2>
        <p className="text-sm text-muted">
          One <code>StorageAdapter</code> contract, swappable backends. The
          editor below talks only to that contract — switch the backend and the
          code driving it does not change.
        </p>
      </div>

      {/* Backend switcher — the whole point: same UI, different adapter. */}
      <div className="flex flex-wrap items-center gap-2">
        <BackendButton
          active={backend === "browser"}
          onClick={useBrowser}
          label="Browser (localStorage)"
        />
        {isFolderBackendAvailable() ? (
          <BackendButton
            active={backend === "folder"}
            onClick={connectFolder}
            label={backend === "folder" ? "Local folder ✓" : "Pick a folder…"}
          />
        ) : (
          <span className="rounded border border-line px-3 py-1.5 text-sm text-muted">
            Local folder — needs a Chromium browser
          </span>
        )}
      </div>

      {/* Live playground. */}
      <div className="flex flex-col gap-3 rounded-md border border-line bg-surface p-4">
        <AdapterFacts adapter={adapter} snapshot={snapshot} />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          spellCheck={false}
          placeholder="Type a document, then Save. Reload the page — it persists."
          className="w-full resize-y rounded border border-line bg-surface-2 p-2 font-mono text-sm text-fg outline-none focus:border-accent"
        />
        <div className="flex flex-wrap items-center gap-2">
          <PrimaryButton onClick={save} label="Save" />
          <SecondaryButton
            onClick={() => void reload(adapter)}
            label="Reload"
          />
          <SecondaryButton
            onClick={() => {
              setText("");
              setStatus({ kind: "idle", message: "" });
            }}
            label="Clear editor"
          />
          <StatusPill status={status} />
        </div>
        <p className="text-xs text-muted">
          Try opening this page in a second tab, saving there, then saving here:
          the adapter raises a <code>ConflictError</code> carrying the other
          tab&apos;s bytes instead of clobbering them.
        </p>
      </div>

      {/* How the live playground is wired. */}
      <CodeBlock
        title="The code behind the playground"
        code={PLAYGROUND_CODE}
      />

      {/* Cloud backends: same contract, app supplies its own credentials. */}
      <div className="rounded-md border border-line bg-surface p-4">
        <h3 className="mb-1 text-sm font-bold text-fg-bright">
          Cloud backends
        </h3>
        <p className="mb-3 text-sm text-muted">
          Dropbox and Google Drive implement the exact same contract — you build
          the adapter once OAuth has handed you a token, then drive it with the
          identical <code>load</code> / <code>save</code> calls above.
          <code> withLocalCache</code> makes either one readable offline.
        </p>
        <CodeBlock title="Dropbox" code={DROPBOX_CODE} />
        <div className="h-3" />
        <CodeBlock title="Google Drive" code={GDRIVE_CODE} />
      </div>
    </section>
  );
}

// ---- presentational helpers ----------------------------------------------

type Status = { kind: "idle" | "ok" | "err"; message: string };

function describe(err: unknown): string {
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}

function AdapterFacts({
  adapter,
  snapshot,
}: {
  adapter: StorageAdapter;
  snapshot: StoredSnapshot | null;
}) {
  const caps: AdapterCapability[] = [...adapter.capabilities];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      <span>
        <span className="text-fg">id</span> <code>{adapter.id}</code>
      </span>
      <span>
        <span className="text-fg">label</span> {adapter.label}
      </span>
      <span className="flex items-center gap-1">
        <span className="text-fg">capabilities</span>
        {caps.length ? (
          caps.map((c) => (
            <code
              key={c}
              className="rounded bg-surface-3 px-1.5 py-0.5 text-fg"
            >
              {c}
            </code>
          ))
        ) : (
          <span>none</span>
        )}
      </span>
      {snapshot?.revision !== undefined && (
        <span>
          <span className="text-fg">revision</span>{" "}
          <code>{truncate(snapshot.revision, 18)}</code>
        </span>
      )}
      {snapshot?.offline && <span className="text-flag">offline copy</span>}
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function BackendButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "cursor-pointer rounded border px-3 py-1.5 text-sm font-bold " +
        (active
          ? "border-accent bg-accent/20 text-accent"
          : "border-line text-fg hover:bg-surface-2")
      }
    >
      {label}
    </button>
  );
}

function PrimaryButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer rounded border border-line bg-accent/15 px-3 py-1.5 text-sm font-bold text-accent hover:bg-accent/25"
    >
      {label}
    </button>
  );
}

function SecondaryButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer rounded border border-line px-3 py-1.5 text-sm text-fg hover:bg-surface-2"
    >
      {label}
    </button>
  );
}

function StatusPill({ status }: { status: Status }) {
  if (status.kind === "idle" || !status.message) return null;
  const tone = status.kind === "err" ? "text-danger" : "text-success";
  return <span className={`text-sm ${tone}`}>{status.message}</span>;
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <div className="overflow-hidden rounded-md border border-line bg-surface-2">
      <div className="border-b border-line px-3 py-1.5 text-xs font-bold tracking-wide text-muted uppercase">
        {title}
      </div>
      <pre className="overflow-x-auto p-3 text-xs leading-relaxed text-fg">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ---- code snippets shown in the demo --------------------------------------

const PLAYGROUND_CODE = `import {
  BrowserLocalStorageAdapter,
  createFolderAdapter,
  ConflictError,
  type StorageAdapter,
} from "@niclaslindstedt/oss-framework/storage";

// Pick a backend — every one satisfies the same StorageAdapter contract.
let adapter: StorageAdapter = new BrowserLocalStorageAdapter({
  key: "myapp:document",
});

// Swap to a user-picked local folder (Chromium) — nothing else changes.
const handle = await window.showDirectoryPicker();
adapter = createFolderAdapter(handle, { fileName: "myapp.json" });

// Load. The browser backend also has a synchronous fast path (loadSync).
let revision: string | undefined;
const snap = await adapter.load();
revision = snap?.revision;

// Save, handing back the revision the edit was based on.
try {
  const saved = await adapter.save(text, revision);
  revision = saved.revision;
} catch (err) {
  if (err instanceof ConflictError) {
    // The remote moved — err.remote carries the newer bytes to merge.
    showConflict(err.remote);
  }
}`;

const DROPBOX_CODE = `import {
  startDropboxAuth,
  completeDropboxAuth,
  createDropboxAdapter,
  withLocalCache,
  localCacheKey,
} from "@niclaslindstedt/oss-framework/storage";

// 1. On "Connect", redirect to the consent screen (PKCE).
await startDropboxAuth(DROPBOX_APP_KEY);

// 2. Back from the redirect, trade ?code= for tokens (you persist them).
const { accessToken, refreshToken } =
  await completeDropboxAuth(DROPBOX_APP_KEY, code);

// 3. Build the adapter — same load/save API. Wrap it so it reads offline.
const adapter = withLocalCache(
  createDropboxAdapter({
    accessToken,
    refreshToken,
    onAccessTokenRefreshed: persistAccessToken, // silent refresh on 401
  }),
  { storage: localStorage, key: localCacheKey("dropbox", "main") },
);`;

const GDRIVE_CODE = `import {
  startGdriveAuth,
  createGdriveAdapter,
  withLocalCache,
  localCacheKey,
} from "@niclaslindstedt/oss-framework/storage";

// GIS consent popup → short-lived access token (drive.file scope).
const token = await startGdriveAuth(GOOGLE_CLIENT_ID);

const adapter = withLocalCache(
  createGdriveAdapter(token, { appFolderName: "MyApp" }),
  { storage: localStorage, key: localCacheKey("gdrive", "main") },
);

// Re-prompt with startGdriveAuth on an AuthError (popup tokens expire).`;
