// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { useEscapeKey } from "../hooks/useEscapeKey.ts";
import type { FeatureDoc } from "./feature-docs.ts";
import type { ChangelogEntryType, ChangelogRelease } from "./parse.ts";
import { renderInlineMarkdown, renderMarkdownDoc } from "./render.tsx";

// "What's new" dialog. Lists every shipped release (parsed from a CHANGELOG.md
// by `parseChangelog`, passed in via `releases`), newest first, rendering each
// bullet's inline markdown. A bullet carrying a `[Learn more](feature:<slug>)`
// link drills into the matching feature doc (`featureDocs[slug]`) in place,
// with a back button.
//
// The component is self-contained: it ships its own accessible overlay
// (portalled to `document.body`, Escape-to-close via the framework's
// `useEscapeKey`, backdrop click, body-scroll lock, focus capture/restore) and
// its own back/close glyphs, so an adopting app needs no modal system, icon
// set, or i18n runtime. Visible strings are injectable via `labels`; the
// per-kind accent classes via `typeColors`. Both default to English / the
// framework theme's semantic colour slots.

// One accent per Keep-a-Changelog kind, using the framework theme's semantic
// colour slots (see the `theme` module). Override via the `typeColors` prop.
export const DEFAULT_TYPE_COLORS: Record<ChangelogEntryType, string> = {
  Added: "text-positive",
  Changed: "text-accent",
  Fixed: "text-success",
  Removed: "text-negative",
  Security: "text-danger",
  Deprecated: "text-muted",
};

export type ChangelogLabels = {
  // Dialog title shown over the release list.
  heading: string;
  // Shown when `releases` is empty.
  empty: string;
  // Accessible label for the close (×) button.
  close: string;
  // Accessible label for the back (←) button in the feature-doc view.
  back: string;
};

export const DEFAULT_CHANGELOG_LABELS: ChangelogLabels = {
  heading: "Changelog",
  empty: "No releases yet.",
  close: "Close",
  back: "Back",
};

type Props = {
  open: boolean;
  onClose: () => void;
  // The releases to list, newest first — typically `parseChangelog(md)`.
  releases: readonly ChangelogRelease[];
  // Optional slug → doc map backing the `feature:<slug>` "Learn more"
  // drill-down — typically `buildFeatureDocs(import.meta.glob(...))`. Without
  // it (or for an unknown slug) such links render as inert text.
  featureDocs?: Record<string, FeatureDoc>;
  // Override any subset of the visible strings (defaults are English).
  labels?: Partial<ChangelogLabels>;
  // Override any subset of the per-kind accent classes.
  typeColors?: Partial<Record<ChangelogEntryType, string>>;
};

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable={false}
      className={className}
    >
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable={false}
      className={className}
    >
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

// Minimal accessible overlay: a dimmed backdrop with a centered card. Closes
// on Escape (via the framework's `useEscapeKey`) and backdrop click, locks
// body scroll while open, and moves focus into the card on open / restores it
// on close. Portalled to `document.body` so it escapes any ancestor stacking
// context.
function Overlay({
  open,
  onClose,
  labelledBy,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEscapeKey(open, onClose);

  useLayoutEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    cardRef.current?.focus();
    return () => {
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-md border border-line bg-surface text-fg shadow-xl outline-none"
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function ChangelogModal({
  open,
  onClose,
  releases,
  featureDocs,
  labels,
  typeColors,
}: Props) {
  const text = { ...DEFAULT_CHANGELOG_LABELS, ...labels };
  const colors = { ...DEFAULT_TYPE_COLORS, ...typeColors };

  // When set to a known slug the modal shows that feature doc in place of the
  // release list; the header grows a back button that clears it. A slug with no
  // bundled doc is ignored, so the link is inert rather than a dead end.
  const [docSlug, setDocSlug] = useState<string | null>(null);

  // We want a doc to open at its top but Back to land on the exact release-list
  // position the reader left — so stash the list's scrollTop on the way in and
  // restore it on the way back.
  const listScrollRef = useRef(0);
  const listDivRef = useRef<HTMLDivElement>(null);
  const docDivRef = useRef<HTMLDivElement>(null);

  // Drop back to the release list whenever the modal reopens, so a later open
  // doesn't inherit the previous session's drill-down or scroll.
  useEffect(() => {
    if (open) {
      setDocSlug(null);
      listScrollRef.current = 0;
    }
  }, [open]);

  const openFeature = (slug: string) => {
    if (!featureDocs?.[slug]) return;
    // Remember where the list was before swapping it for the doc. When
    // cross-linking doc→doc the list is already unmounted, so keep the saved
    // value rather than clobbering it with 0.
    listScrollRef.current =
      listDivRef.current?.scrollTop ?? listScrollRef.current;
    setDocSlug(slug);
  };

  // Land a freshly-opened doc at its top; restore the release list to its saved
  // position when Back returns to it. `useLayoutEffect` runs before paint, so
  // neither jump flickers.
  useLayoutEffect(() => {
    if (docSlug) {
      if (docDivRef.current) docDivRef.current.scrollTop = 0;
    } else if (listDivRef.current) {
      listDivRef.current.scrollTop = listScrollRef.current;
    }
  }, [docSlug]);

  const activeDoc = docSlug ? featureDocs?.[docSlug] : undefined;

  if (activeDoc) {
    return (
      <Overlay open={open} onClose={onClose} labelledBy="changelog-title">
        <header className="flex shrink-0 items-center gap-2 border-b border-line bg-surface-3 px-2 py-3">
          <button
            type="button"
            onClick={() => setDocSlug(null)}
            aria-label={text.back}
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-fg"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <h2
            id="changelog-title"
            className="flex-1 truncate text-sm font-bold tracking-wide text-fg-bright"
          >
            {activeDoc.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={text.close}
            className="-mr-1 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-fg"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </header>

        {/* Key by slug so opening a doc (or cross-linking to a sibling) mounts
            a fresh scroll container, landing at the top instead of inheriting
            the release list's scroll position. */}
        <div
          key={`doc-${docSlug}`}
          ref={docDivRef}
          className="flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4 text-sm leading-relaxed text-fg"
        >
          {renderMarkdownDoc(activeDoc.body, { onOpenFeature: openFeature })}
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay open={open} onClose={onClose} labelledBy="changelog-title">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line bg-surface-3 px-4 py-3">
        <h2
          id="changelog-title"
          className="text-sm font-bold tracking-wide text-fg-bright"
        >
          {text.heading}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={text.close}
          className="-mr-1 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-fg"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </header>

      <div
        key="list"
        ref={listDivRef}
        className="flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4 text-sm"
      >
        {releases.length === 0 ? (
          <p className="py-8 text-center text-muted">{text.empty}</p>
        ) : (
          <div className="flex flex-col gap-6">
            {releases.map((release) => (
              <section key={release.version} className="flex flex-col gap-2">
                <h3 className="flex items-baseline gap-2 border-b border-line pb-1">
                  <span className="font-bold text-fg-bright">
                    {release.version}
                  </span>
                  {release.date && (
                    <span className="text-xs text-muted tabular-nums">
                      {release.date}
                    </span>
                  )}
                </h3>
                {release.sections.map((section, si) => (
                  <div key={si} className="flex flex-col gap-1">
                    <p
                      className={`text-xs font-bold tracking-wide ${colors[section.type]}`}
                    >
                      {section.type}
                    </p>
                    <ul className="ml-4 list-disc space-y-1 text-fg">
                      {section.items.map((item, i) => (
                        <li key={i}>
                          {renderInlineMarkdown(item, {
                            onOpenFeature: openFeature,
                          })}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            ))}
          </div>
        )}
      </div>
    </Overlay>
  );
}
