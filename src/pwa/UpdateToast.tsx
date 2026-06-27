// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Button } from "../components/Button.tsx";
import { CloseIcon, RefreshIcon } from "../components/icons.tsx";

// Soft "an update is ready" prompt. The new service worker has already
// downloaded and is parked in the `waiting` state; pressing the action button
// applies it (the `controlling` listener in `usePwaUpdate` reloads the page).
// Surfacing this rather than auto-refreshing is deliberate — a silent swap
// would discard in-progress edits. It pins above the safe-area inset at
// `z-[60]`, just under a general toast stack.
//
// Presentational on purpose: it takes the update state + callbacks as props
// rather than calling `usePwaUpdate` itself, so the singleton's state can drive
// several surfaces at once (a header progress fill, this prompt) and so a host
// owns the wiring. Drive it with `usePwaUpdate`:
//
//   const u = usePwaUpdate({ base, cacheId });
//   <UpdateToast
//     needRefresh={u.needRefresh}
//     incomingVersion={u.incomingVersion}
//     onReload={u.reload}
//     onDismiss={u.dismiss}
//   />
//
// Centring on a wide screen: the toast is viewport-`fixed`, so on a layout with
// a docked sidebar it would centre over the whole window and land off-centre
// over the content. It reads the `--app-content-{left,right}` insets the
// `sidebar` module's `useSidebarInset` publishes to pull its centring band in
// to match the content area; both default to 0, so without a sidebar nothing
// shifts.

export type UpdateToastLabels = {
  // Headline shown when an update is ready.
  ready: string;
  // The apply-now button.
  action: string;
  // Accessible label for the dismiss (×) button.
  dismiss: string;
  // Formats the incoming version line; receives the raw version string.
  version: (version: string) => string;
};

export const DEFAULT_UPDATE_TOAST_LABELS: UpdateToastLabels = {
  ready: "A new version is ready",
  action: "Update",
  dismiss: "Dismiss",
  version: (version) => `Version ${version}`,
};

export type UpdateToastProps = {
  // True once a new build is installed and waiting — the prompt shows only
  // then. Wire from `usePwaUpdate().needRefresh`.
  needRefresh: boolean;
  // The incoming build's version label, shown truncated under the headline.
  incomingVersion?: string | null;
  // Apply the waiting build. Wire from `usePwaUpdate().reload`.
  onReload: () => void;
  // Hide the prompt. Wire from `usePwaUpdate().dismiss`.
  onDismiss: () => void;
  // Override any of the visible strings (English by default).
  labels?: Partial<UpdateToastLabels>;
};

export function UpdateToast({
  needRefresh,
  incomingVersion,
  onReload,
  onDismiss,
  labels,
}: UpdateToastProps) {
  if (!needRefresh) return null;
  const l = { ...DEFAULT_UPDATE_TOAST_LABELS, ...labels };

  return (
    <div
      role="status"
      aria-live="polite"
      data-toast-stack
      className="fixed right-[calc(0.75rem+var(--app-content-right,0px))] bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-[calc(0.75rem+var(--app-content-left,0px))] z-[60] mx-auto flex max-w-md items-center gap-3 rounded-sm border border-line bg-surface px-3 py-2.5 text-fg shadow-md"
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium">{l.ready}</span>
        {incomingVersion && (
          <span className="truncate text-xs text-muted tabular-nums">
            {l.version(incomingVersion)}
          </span>
        )}
      </div>
      <Button
        variant="primary"
        className="inline-flex shrink-0 items-center gap-1.5"
        onClick={onReload}
      >
        <RefreshIcon className="h-4 w-4" />
        {l.action}
      </Button>
      <button
        type="button"
        aria-label={l.dismiss}
        className="inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted hover:text-fg"
        onClick={onDismiss}
      >
        <CloseIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
