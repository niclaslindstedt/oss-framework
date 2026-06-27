// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  useEffect,
  useId,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

import {
  Button,
  Modal,
  ChevronDownIcon,
  ChevronRightIcon,
  CloseIcon,
  CloudAlertIcon,
  CloudCheckIcon,
  CloudIcon,
  CloudOffIcon,
  CloudUploadIcon,
  ExternalLinkIcon,
  FolderIcon,
  LockIcon,
  RefreshIcon,
  ScrollTextIcon,
  ShieldIcon,
  SpinnerIcon,
  type IconProps,
} from "../components/index.ts";
import {
  DEFAULT_SYNC_DETAILS_LABELS,
  type SyncDetailsLabels,
} from "./labels.ts";
import type {
  BackendKind,
  ConnectionProbeResult,
  SaveStatus,
  SyncLocation,
} from "./types.ts";

// The sync command centre — the one place that answers "what is sync doing
// right now". The header sync glyph (`SyncStatus`) always opens it, whatever
// the state. It lays out, top to bottom: the headline status and *why* a save
// failed (with Reconnect / Save now / Try again, a compact Reload glyph, and —
// while offline — a Check connection re-probe); the backend, its at-rest
// encryption state, and the on-disk file location; and an optional collapsible
// developer log (you decide whether to render the slot).
//
// The seam: this component is purely presentational. Your sync engine owns the
// state and the actions; the framework owns the layout. The store stays in
// your app.

type Props = {
  open: boolean;
  /** The backend's display name. */
  providerName: string;
  /** Cloud vs folder — picks the glyph in the Details grid. */
  backendKind?: BackendKind;
  /** Where the document lives — the path shown and the optional "Open in" link. */
  location: SyncLocation;
  /** Whether the backend writes encrypted at rest (drives the On/Off chip). */
  encrypted?: boolean;
  status: SaveStatus;
  /** A specific reason for `error` state; falls back to a generic line. */
  statusDetail?: string | null;
  dirty: boolean;
  /** True when the backend is unreachable and we're on the on-device copy. */
  offline: boolean;
  /** Flush queued edits now. Omit to hide the Save now button. */
  onSaveNow?: () => void;
  /** Re-read the document from the backend, replacing what's on screen. Omit
   *  to hide the compact Reload glyph. */
  onReload?: () => void;
  // Re-issue the backend grant (OAuth for the clouds, the OS folder permission
  // for a picked folder). Resolves on success and throws on failure so the
  // inline button can spin while the popup / redirect runs and surface the
  // failure. Null/omitted when the backend has no reconnect gesture.
  onReconnect?: (() => Promise<void>) | null;
  // Actively re-probe backend reachability — wired to "Check connection",
  // shown while offline. Resolves with what the probe found so the button can
  // report it; recovery (re-read + flush) happens engine-side. Omit to hide it.
  onCheckConnection?: () => Promise<ConnectionProbeResult>;
  // An optional developer-diagnostic log. When provided, a collapsible
  // "View sync log" section wraps it. Gate this app-side (e.g. only in dev
  // mode) and pass the framework's `LogViewer` — the framework doesn't decide
  // who sees the log.
  logPanel?: ReactNode;
  onClose: () => void;
  labels?: Partial<SyncDetailsLabels>;
};

type IconComponent = (props: IconProps) => ReactElement;

type Tone = "ok" | "busy" | "warn" | "err" | "flag" | "accent";

// The glyph that names the backend family in the Details grid.
function backendGlyph(kind: BackendKind): ReactElement {
  const className = "h-3.5 w-3.5 shrink-0 text-muted";
  return kind === "folder" ? (
    <FolderIcon className={className} />
  ) : (
    <CloudIcon className={className} />
  );
}

type StatusView = {
  Icon: IconComponent;
  label: string;
  tone: Tone;
  detail?: string;
  spin?: boolean;
};

function statusView(
  status: SaveStatus,
  statusDetail: string | null | undefined,
  dirty: boolean,
  offline: boolean,
  providerName: string,
  labels: SyncDetailsLabels,
): StatusView {
  // Offline takes precedence (see `SyncStatus`): explain that the user is on a
  // local copy that re-syncs on reconnect, rather than implying a sync.
  if (offline) {
    return {
      Icon: CloudOffIcon,
      label: labels.offlineHeading,
      tone: "flag",
      detail: labels.offlineDetail(providerName),
    };
  }
  switch (status) {
    case "saving":
      return {
        Icon: SpinnerIcon,
        label: labels.syncingNow,
        tone: "busy",
        spin: true,
      };
    case "error":
      return {
        Icon: CloudAlertIcon,
        label: labels.failedHeading,
        tone: "err",
        detail: statusDetail ?? labels.failedDetailFallback(providerName),
      };
    case "throttled":
      return {
        Icon: CloudAlertIcon,
        label: labels.throttledHeading,
        tone: "flag",
        detail: labels.throttledDetail(providerName),
      };
    case "auth-error":
      return {
        Icon: CloudAlertIcon,
        label: labels.reauthHeading,
        tone: "warn",
        detail: labels.reauthDetail(providerName),
      };
    case "conflict":
      return {
        Icon: CloudAlertIcon,
        label: labels.conflictHeading,
        tone: "warn",
        detail: labels.conflictDetail,
      };
    case "saved":
    case "idle":
      return dirty
        ? {
            Icon: CloudUploadIcon,
            label: labels.pendingHeading,
            tone: "accent",
            detail: labels.pendingDetail(providerName),
          }
        : {
            Icon: CloudCheckIcon,
            label: labels.syncedTo(providerName),
            tone: "ok",
          };
  }
}

const TONE_BORDER: Record<Tone, string> = {
  ok: "border-success/40 bg-success/5",
  busy: "border-line bg-surface-2",
  warn: "border-pipe/50 bg-pipe/5",
  err: "border-danger/50 bg-danger/5",
  flag: "border-flag/50 bg-flag/5",
  accent: "border-accent bg-accent/10",
};

const TONE_TEXT: Record<Tone, string> = {
  ok: "text-success",
  busy: "text-muted",
  warn: "text-pipe",
  err: "text-danger",
  flag: "text-flag",
  accent: "text-accent",
};

export function SyncDetailsModal({
  open,
  providerName,
  backendKind = "cloud",
  location,
  encrypted = false,
  status,
  statusDetail,
  dirty,
  offline,
  onSaveNow,
  onReload,
  onReconnect,
  onCheckConnection,
  logPanel,
  onClose,
  labels,
}: Props) {
  const merged = { ...DEFAULT_SYNC_DETAILS_LABELS, ...labels };
  const titleId = useId();
  const [reconnectPending, setReconnectPending] = useState(false);
  const [reconnectError, setReconnectError] = useState<string | null>(null);
  // Live state of the "Check connection" probe so the user sees what's
  // happening — a spinner while it reaches the backend, then the outcome.
  const [checkPending, setCheckPending] = useState(false);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);
  const [checkTone, setCheckTone] = useState<Tone>("busy");
  const [logOpen, setLogOpen] = useState(false);

  // Reset the inline reconnect state whenever the modal closes or the session
  // leaves the auth-error state, so a stale spinner / error never greets a
  // later open.
  useEffect(() => {
    if (!open) {
      setReconnectPending(false);
      setReconnectError(null);
    }
  }, [open]);
  useEffect(() => {
    if (status !== "auth-error") setReconnectError(null);
  }, [status]);
  // Drop the connection-check result once the modal closes or we're no longer
  // offline, so a stale "still offline" line never lingers behind a now-synced
  // state.
  useEffect(() => {
    if (!open || !offline) {
      setCheckPending(false);
      setCheckMessage(null);
    }
  }, [open, offline]);

  const state = statusView(
    status,
    statusDetail,
    dirty,
    offline,
    providerName,
    merged,
  );
  const busy = status === "saving";
  const reconnect = onReconnect ?? null;
  const showReconnect = status === "auth-error" && reconnect !== null;

  const handleReconnect = async () => {
    if (!reconnect || reconnectPending) return;
    setReconnectPending(true);
    setReconnectError(null);
    try {
      await reconnect();
    } catch (err) {
      setReconnectError(err instanceof Error ? err.message : String(err));
    } finally {
      setReconnectPending(false);
    }
  };

  const handleCheckConnection = async () => {
    if (!onCheckConnection || checkPending) return;
    setCheckPending(true);
    // Show progress straight away so the button never looks inert.
    setCheckTone("busy");
    setCheckMessage(merged.checkPinging(providerName));
    try {
      const result = await onCheckConnection();
      if (result === "online") {
        // No sticky "back online" line: when the connection truly holds the
        // status card flips to Synced (and this whole offline block unmounts),
        // which is the feedback. A success message would survive and contradict
        // the card if the queued save then re-flags offline on a flaky write.
        setCheckMessage(null);
      } else if (result === "auth-error") {
        setCheckTone("warn");
        setCheckMessage(merged.checkAuthExpired(providerName));
      } else {
        setCheckTone("flag");
        setCheckMessage(merged.checkStillOffline(providerName));
      }
    } catch (err) {
      setCheckTone("err");
      setCheckMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setCheckPending(false);
    }
  };

  const showSaveNow =
    !!onSaveNow &&
    !busy &&
    !showReconnect &&
    (status === "error" || (dirty && status !== "conflict"));
  const saveLabel = status === "error" ? merged.tryAgain : merged.saveNow;

  const reconnectLabel =
    reconnectError !== null ? merged.tryAgain : merged.reconnect(providerName);
  const ReconnectIcon: IconComponent = reconnectPending
    ? SpinnerIcon
    : RefreshIcon;
  const CheckIcon: IconComponent = checkPending ? SpinnerIcon : RefreshIcon;
  const showCheck = offline && !!onCheckConnection;

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      closeLabel={merged.close}
      centered
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line bg-surface-3 px-4 py-3">
        <h2
          id={titleId}
          className="flex items-center gap-2 text-sm font-bold tracking-wide text-fg-bright"
        >
          <CloudIcon className="h-4 w-4" />
          {merged.cloudSync}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={merged.close}
          className="-mr-1 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-fg"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4">
        {/* Headline status — what sync is doing and, on failure, why. */}
        <section className="flex flex-col gap-2">
          <SectionLabel>{merged.status}</SectionLabel>
          {/* The status card and a reload glyph share a row — reload is a
              compact icon here (whatever the state) rather than a full-width
              button below, to save vertical space. */}
          <div className="flex items-stretch gap-2">
            <div
              className={`flex flex-1 items-start gap-2 rounded-md border px-2.5 py-2 ${TONE_BORDER[state.tone]}`}
            >
              <state.Icon
                className={`mt-0.5 h-4 w-4 shrink-0 ${TONE_TEXT[state.tone]} ${
                  state.spin ? "animate-spin" : ""
                }`}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className={`text-sm font-bold ${TONE_TEXT[state.tone]}`}>
                  {state.label}
                </span>
                {state.detail && (
                  <p className="text-xs break-words whitespace-pre-wrap text-fg">
                    {state.detail}
                  </p>
                )}
              </div>
            </div>
            {onReload && (
              <button
                type="button"
                onClick={onReload}
                title={merged.reloadFromBackend}
                aria-label={merged.reloadFromBackend}
                className="inline-flex w-10 shrink-0 cursor-pointer items-center justify-center rounded-md border border-line bg-surface-2 text-muted hover:border-accent hover:text-accent"
              >
                <RefreshIcon className="h-4 w-4" />
              </button>
            )}
          </div>

          {(showReconnect || showSaveNow) && (
            <div className="flex flex-wrap items-center gap-2">
              {showReconnect && (
                <button
                  type="button"
                  onClick={handleReconnect}
                  disabled={reconnectPending}
                  aria-busy={reconnectPending || undefined}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-md border border-accent bg-accent/10 px-3 py-1.5 text-sm font-bold text-accent hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-70 ${
                    reconnectPending ? "" : "cursor-pointer"
                  }`}
                >
                  <ReconnectIcon
                    className={`h-3.5 w-3.5 ${reconnectPending ? "animate-spin" : ""}`}
                  />
                  {reconnectLabel}
                </button>
              )}

              {showSaveNow && (
                <button
                  type="button"
                  onClick={onSaveNow}
                  className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-accent bg-accent/10 px-3 py-1.5 text-sm font-bold text-accent hover:bg-accent/20"
                >
                  <CloudUploadIcon className="h-3.5 w-3.5" />
                  {saveLabel}
                </button>
              )}
            </div>
          )}

          {reconnectError && (
            <p className="text-xs break-words text-danger">{reconnectError}</p>
          )}

          {/* While offline, an active re-probe with live status, so the user
              can confirm connectivity rather than wait for the next save. */}
          {showCheck && (
            <>
              <button
                type="button"
                onClick={handleCheckConnection}
                disabled={checkPending}
                aria-busy={checkPending || undefined}
                className={`inline-flex items-center justify-center gap-1.5 self-start rounded-md border border-flag bg-flag/10 px-3 py-1.5 text-sm font-bold text-flag hover:bg-flag/20 disabled:cursor-not-allowed disabled:opacity-70 ${
                  checkPending ? "" : "cursor-pointer"
                }`}
              >
                <CheckIcon
                  className={`h-3.5 w-3.5 ${checkPending ? "animate-spin" : ""}`}
                />
                {merged.checkConnection}
              </button>
              {checkMessage && (
                <p
                  className={`text-xs break-words ${TONE_TEXT[checkTone]}`}
                  role="status"
                  aria-live="polite"
                >
                  {checkMessage}
                </p>
              )}
            </>
          )}
        </section>

        {/* Backend + encryption side by side, then the file location. */}
        <section className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <Detail label={merged.backend} icon={backendGlyph(backendKind)}>
              <span className="truncate text-sm text-fg-bright">
                {providerName}
              </span>
            </Detail>
            <Detail
              label={merged.encryptionLabel}
              icon={
                encrypted ? (
                  <LockIcon className="h-3.5 w-3.5 shrink-0 text-accent" />
                ) : (
                  <ShieldIcon className="h-3.5 w-3.5 shrink-0 text-muted" />
                )
              }
            >
              <span
                className={`text-sm font-bold ${encrypted ? "text-accent" : "text-muted"}`}
              >
                {encrypted ? merged.encryptionOn : merged.encryptionOff}
              </span>
            </Detail>
          </div>

          <div className="flex flex-col gap-1">
            <SectionLabel>{merged.fileLocation}</SectionLabel>
            <span className="rounded-md border border-line bg-surface-2 px-2 py-1.5 font-mono text-xs break-all text-fg">
              {location.path}
            </span>
          </div>
        </section>

        {/* Optional developer log. The app decides who sees it (e.g. dev mode
            only) by choosing whether to pass `logPanel`. */}
        {logPanel && (
          <section className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setLogOpen((v) => !v)}
              aria-expanded={logOpen}
              className="flex w-full cursor-pointer items-center gap-2 rounded-md border border-line bg-surface-2 px-2.5 py-1.5 text-left hover:border-accent"
            >
              <ScrollTextIcon className="h-3.5 w-3.5 shrink-0 text-muted" />
              <span className="flex-1 text-xs font-bold text-fg">
                {logOpen ? merged.hideSyncLog : merged.viewSyncLog}
              </span>
              {logOpen ? (
                <ChevronDownIcon className="h-4 w-4 shrink-0 text-muted" />
              ) : (
                <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" />
              )}
            </button>
            {logOpen && logPanel}
          </section>
        )}
      </div>

      <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line bg-surface-3 px-4 py-3">
        <Button variant="secondary" onClick={onClose}>
          {merged.close}
        </Button>
        {location.url && (
          <a
            href={location.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-accent bg-accent/10 px-3 py-1.5 text-sm font-bold text-accent hover:bg-accent/20"
          >
            <ExternalLinkIcon className="h-3.5 w-3.5" />
            {merged.openIn(providerName)}
          </a>
        )}
      </footer>
    </Modal>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-xs font-bold tracking-wide text-muted uppercase">
      {children}
    </span>
  );
}

function Detail({
  label,
  icon,
  children,
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-line bg-surface-2 px-2.5 py-2">
      <span className="text-[0.65rem] font-bold tracking-wide text-muted uppercase">
        {label}
      </span>
      <div className="flex min-w-0 items-center gap-1.5">
        {icon}
        {children}
      </div>
    </div>
  );
}
