// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useEffect, useRef, useState } from "react";

import type {
  BackendKind,
  ConnectionProbeResult,
  SaveStatus,
  SyncLocation,
} from "@niclaslindstedt/oss-framework/sync";

import { logStore } from "./log.ts";
import { docKey, type ChecklistStore } from "./useChecklistStore.ts";

// Route the engine's activity into the shared in-app log buffer under a `sync`
// scope, so the command centre's developer log panel shows the round trip.
const syncLog = logStore.createLogger("sync");

// A *simulated* sync engine for the demo — the "store stays in the app" seam
// the framework's `sync` surface paints over. A real app would push its
// document to a cloud drive / a server and report the lifecycle; the demo has
// no backend, so this hook fakes one realistically: it watches the document
// store's edit counter to know when there are unsaved changes, debounces a
// "save" that flips Saving → Saved, and lets the Developer tab inject the
// faults (offline / expired session / conflict / rate-limit) that exercise the
// command centre's recovery affordances.
//
// This is exactly the shape an adopter writes: the framework owns none of this
// state machine — it only renders `status` / `dirty` / `offline` and calls the
// action handlers back.

export type SyncBackend = "local" | "cloud";
export type SyncFault =
  | "none"
  | "offline"
  | "auth-error"
  | "conflict"
  | "throttled";

// The cloud drives a real local-first PWA can sync to. The demo's cloud is
// simulated (see the header note), so these differ only in their display name
// and the folder path the `SyncDetailsModal` reports — but that is exactly the
// choice an adopter exposes, and picking one flows straight into the header
// `SyncStatus` glyph ("synced to {name}"). A long, flat list like this is the
// natural home for a type-ahead `SelectPicker`: type "one" to land on OneDrive.
export type CloudProvider = {
  id: string;
  name: string;
  // The path stem shown as "where your data lives"; the document slug is
  // appended per list.
  folder: string;
};

export const CLOUD_PROVIDERS: readonly CloudProvider[] = [
  { id: "gdrive", name: "Google Drive", folder: "Apps/OSS Demo" },
  { id: "dropbox", name: "Dropbox", folder: "Apps/OSS Demo" },
  { id: "onedrive", name: "OneDrive", folder: "Apps/OSS Demo" },
  { id: "icloud", name: "iCloud Drive", folder: "OSS Demo" },
  { id: "webdav", name: "WebDAV server", folder: "dav/oss-demo" },
  { id: "s3", name: "Amazon S3", folder: "oss-demo-bucket" },
  { id: "nextcloud", name: "Nextcloud", folder: "Files/OSS Demo" },
];

const DEFAULT_PROVIDER_ID = "gdrive";

function providerById(id: string): CloudProvider {
  return CLOUD_PROVIDERS.find((p) => p.id === id) ?? CLOUD_PROVIDERS[0];
}

const BACKEND_KEY = "oss-demo:sync:backend";
const PROVIDER_KEY = "oss-demo:sync:provider";
const ENCRYPTED_KEY = "oss-demo:sync:encrypted";
// Snappy timings so the lifecycle reads in a few seconds of clicking around.
const SAVE_DEBOUNCE_MS = 700;
const SAVE_DURATION_MS = 650;
const THROTTLE_RETRY_MS = 1400;

export type MockSync = {
  backend: SyncBackend;
  setBackend: (b: SyncBackend) => void;
  // Which cloud drive the (simulated) cloud backend syncs to. Only meaningful
  // while `backend === "cloud"`; its name surfaces in the header `SyncStatus`
  // and its folder in the `SyncDetailsModal`.
  providerId: string;
  setProviderId: (id: string) => void;
  encrypted: boolean;
  setEncrypted: (v: boolean) => void;
  fault: SyncFault;
  /** Inject a fault (Developer tab). Only meaningful on the cloud backend. */
  setFault: (f: SyncFault) => void;
  // The inputs the framework `SyncStatus` / `SyncDetailsModal` render over.
  status: SaveStatus;
  dirty: boolean;
  offline: boolean;
  providerName: string;
  backendKind: BackendKind;
  location: SyncLocation;
  // The action handlers the modal calls back.
  saveNow: () => void;
  reload: () => void;
  reconnect: (() => Promise<void>) | null;
  checkConnection: () => Promise<ConnectionProbeResult>;
};

function readBackend(): SyncBackend {
  return localStorage.getItem(BACKEND_KEY) === "cloud" ? "cloud" : "local";
}

function readProviderId(): string {
  const saved = localStorage.getItem(PROVIDER_KEY);
  return saved && CLOUD_PROVIDERS.some((p) => p.id === saved)
    ? saved
    : DEFAULT_PROVIDER_ID;
}

export function useMockSync(store: ChecklistStore, slug: string): MockSync {
  const [backend, setBackendState] = useState<SyncBackend>(readBackend);
  const [providerId, setProviderIdState] = useState<string>(readProviderId);
  const [encrypted, setEncryptedState] = useState<boolean>(
    () => localStorage.getItem(ENCRYPTED_KEY) === "1",
  );
  const [fault, setFaultState] = useState<SyncFault>("none");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "saved",
  );
  // The edit counter that has been "pushed" to the cloud. Anything newer is
  // unsaved — that's `dirty`.
  const [savedVersion, setSavedVersion] = useState(store.version);

  // Keep the live edit counter reachable from inside timers without making
  // them depend on it (which would reset the debounce on every keystroke).
  const versionRef = useRef(store.version);
  versionRef.current = store.version;

  const isCloud = backend === "cloud";
  const offline = isCloud && fault === "offline";
  const dirty = isCloud && store.version !== savedVersion;

  // A blocking fault can't be saved through — the user must clear it first.
  const blocked =
    fault === "offline" || fault === "auth-error" || fault === "conflict";

  // Map the engine's internal pieces onto the framework's `SaveStatus`.
  const status: SaveStatus =
    !isCloud || fault === "none"
      ? saveState === "saving"
        ? "saving"
        : dirty
          ? "idle"
          : "saved"
      : fault === "auth-error"
        ? "auth-error"
        : fault === "conflict"
          ? "conflict"
          : fault === "throttled"
            ? "throttled"
            : saveState === "saving"
              ? "saving"
              : "idle";

  const doSave = useCallback(() => {
    setSaveState("saving");
    syncLog.info("save: uploading document…");
    window.setTimeout(() => {
      setSavedVersion(versionRef.current);
      setSaveState("saved");
      syncLog.info("save: ok → simulated cloud");
    }, SAVE_DURATION_MS);
  }, []);

  // Debounced auto-save: a settled edit on the cloud backend pushes itself,
  // unless a blocking fault stands in the way. A rate-limit shows "throttled"
  // and then recovers on its own — the backend asked us to slow down, not stop.
  useEffect(() => {
    if (!isCloud || !dirty || blocked) return;
    if (fault === "throttled") {
      const retry = window.setTimeout(() => {
        setFaultState("none");
        doSave();
      }, THROTTLE_RETRY_MS);
      return () => window.clearTimeout(retry);
    }
    const timer = window.setTimeout(doSave, SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [isCloud, dirty, blocked, fault, store.version, doSave]);

  const setBackend = useCallback(
    (b: SyncBackend) => {
      localStorage.setItem(BACKEND_KEY, b);
      // Adopt the cloud backend "in sync": the current document is the
      // baseline, so the glyph starts green rather than flagging the whole
      // seed as unsaved.
      setSavedVersion(store.version);
      setSaveState("saved");
      setFaultState("none");
      setBackendState(b);
    },
    [store.version],
  );

  const setProviderId = useCallback((id: string) => {
    const provider = providerById(id);
    localStorage.setItem(PROVIDER_KEY, provider.id);
    syncLog.info(`backend: switched cloud drive → ${provider.name}`);
    setProviderIdState(provider.id);
  }, []);

  const setEncrypted = useCallback((v: boolean) => {
    localStorage.setItem(ENCRYPTED_KEY, v ? "1" : "0");
    setEncryptedState(v);
  }, []);

  const setFault = useCallback((f: SyncFault) => {
    const line: Record<SyncFault, string> = {
      none: "fault cleared — sync resuming",
      offline: "backend unreachable — switched to the on-device copy",
      "auth-error": "session expired — reconnect required",
      conflict: "conflict: a newer copy exists on the backend",
      throttled: "rate limited — the backend asked us to slow down",
    };
    if (f === "none") syncLog.info(line[f]);
    else syncLog.warn(line[f]);
    setFaultState(f);
  }, []);

  const saveNow = useCallback(() => {
    if (!isCloud || blocked) return;
    setFaultState("none");
    doSave();
  }, [isCloud, blocked, doSave]);

  const reload = useCallback(() => store.reload(), [store]);

  const reconnect = useCallback(async () => {
    // Re-issuing the grant clears the expired session; the queued edits then
    // flush on the next save.
    syncLog.info("reconnect: re-issuing the backend grant…");
    await new Promise((r) => window.setTimeout(r, 500));
    setFaultState("none");
    syncLog.info("reconnect: session restored");
    doSave();
  }, [doSave]);

  const checkConnection =
    useCallback(async (): Promise<ConnectionProbeResult> => {
      syncLog.info("probe: checking backend reachability…");
      await new Promise((r) => window.setTimeout(r, 600));
      if (fault === "offline") {
        syncLog.warn("probe: still offline");
        return "offline";
      }
      if (fault === "auth-error") {
        syncLog.warn("probe: session expired");
        return "auth-error";
      }
      // The probe found the backend reachable — clear the offline flag and let
      // the queue flush.
      setFaultState("none");
      syncLog.info("probe: online");
      return "online";
    }, [fault]);

  const provider = providerById(providerId);

  return {
    backend,
    setBackend,
    providerId,
    setProviderId,
    encrypted,
    setEncrypted,
    fault,
    setFault,
    status,
    dirty,
    offline,
    // The chosen drive's name is what the header `SyncStatus` shows after
    // "synced to …"; on the local backend the data never leaves the device.
    providerName: isCloud ? provider.name : "This device",
    backendKind: isCloud ? "cloud" : "folder",
    location: {
      path: isCloud ? `${provider.folder}/${slug}` : docKey(slug),
      url: null,
    },
    saveNow,
    reload,
    // The local backend has no session to re-issue.
    reconnect: isCloud ? reconnect : null,
    checkConnection,
  };
}
