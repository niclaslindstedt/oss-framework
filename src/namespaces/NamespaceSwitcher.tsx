// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The in-drawer namespace switcher: the collapsible "Namespaces" section a
// local-first app heads its navigation with. Tap a row to make that namespace
// active (switch which document the app shows); the heading's cog opens the
// full management dialog (the `NamespacesModal`, create / rename / restyle /
// delete). Collapsed it shows only the active namespace so the drawer always
// leads with where you are; expanded it lists them all.
//
// It doubles as the drop target for moving items across namespaces: wire the
// optional `dropZone` to your sidebar `useDragDrop` and each *other* namespace's
// row accepts a dropped payload, so a drag lands on the switcher itself rather
// than a separate, drag-only drop strip. Pass `dragging` so the section springs
// open for the duration of a drag (and folds back after) — every namespace is a
// reachable target even when the switcher was collapsed.
//
// Presentational and store-free, like the rest of the namespaces module: your
// app owns the namespace list and the active pointer and threads them in, along
// with the switch / manage handlers. Every user-facing string injects through
// `labels` with English defaults, so the switcher carries no i18n of its own.

import { useState } from "react";

import {
  ChevronDownIcon,
  ChevronRightIcon,
  CogIcon,
} from "../components/index.ts";
import { Glyph } from "../glyphs/index.ts";
import type { DropZoneProps } from "../sidebar/index.ts";
import type { Namespace } from "./namespaces.ts";

/** Visible strings the switcher needs. All optional — English defaults fill any
 *  you omit. `switchTo` interpolates a namespace name (its row's aria-label). */
export type NamespaceSwitcherLabels = {
  /** Section heading above the rows. */
  heading?: string;
  /** Accessible label for the cog that opens the management dialog. */
  manage?: string;
  /** Accessible label for a row, given the namespace name. */
  switchTo?: (name: string) => string;
  /** Accessible label for the collapse toggle while collapsed. */
  expand?: string;
  /** Accessible label for the collapse toggle while expanded. */
  collapse?: string;
};

const DEFAULTS = {
  heading: "Namespaces",
  manage: "Manage namespaces",
  switchTo: (name: string) => `Switch to ${name}`,
  expand: "Show namespaces",
  collapse: "Hide namespaces",
} satisfies Required<NamespaceSwitcherLabels>;

type Props = {
  namespaces: Namespace[];
  /** Slug of the active namespace (its row is highlighted, never a drop target). */
  activeNamespace: string;
  /** Make a namespace active. */
  onSwitch: (slug: string) => void;
  /** Open the management dialog (the cog beside the heading). */
  onManage: () => void;
  /**
   * Optional drag-and-drop wiring. Return a drop zone (from a sidebar
   * `useDragDrop`) for the given slug and that namespace's row becomes a target
   * — dropping a payload onto it is your `onDrop`'s "move into this namespace".
   * Only the *non-active* rows ask for a zone.
   */
  dropZone?: (slug: string) => DropZoneProps;
  /**
   * Whether a drag is in flight. While true the switcher force-expands so every
   * namespace is a reachable drop target, then folds back to its prior state.
   */
  dragging?: boolean;
  /** Whether the switcher starts collapsed (active row only). Default true. */
  defaultCollapsed?: boolean;
  labels?: NamespaceSwitcherLabels;
};

export function NamespaceSwitcher({
  namespaces,
  activeNamespace,
  onSwitch,
  onManage,
  dropZone,
  dragging = false,
  defaultCollapsed = true,
  labels,
}: Props) {
  const l = { ...DEFAULTS, ...labels };
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  // The collapse toggle only earns its keep with more than one namespace —
  // a lone namespace reads the same collapsed or open, so the chevron is dropped.
  const collapsible = namespaces.length > 1;
  // A live drag wins over the collapsed preference: every namespace must be a
  // reachable target for the duration, then the switcher folds back to where the
  // user left it.
  const expanded = !collapsible || !collapsed || dragging;

  const shown = expanded
    ? namespaces
    : namespaces.filter((ns) => ns.slug === activeNamespace);

  return (
    <div className="shrink-0">
      <div className="flex items-center justify-between gap-2 px-5 pt-3 pb-1">
        {collapsible ? (
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-expanded={expanded}
            aria-label={collapsed ? l.expand : l.collapse}
            title={collapsed ? l.expand : l.collapse}
            className="-ml-1 flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded py-0.5 pl-1 text-left text-muted hover:text-fg-bright"
          >
            {expanded ? (
              <ChevronDownIcon className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <ChevronRightIcon className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="text-xs font-semibold tracking-wide text-muted uppercase">
              {l.heading}
            </span>
          </button>
        ) : (
          <span className="text-xs font-semibold tracking-wide text-muted uppercase">
            {l.heading}
          </span>
        )}
        <button
          type="button"
          onClick={onManage}
          aria-label={l.manage}
          title={l.manage}
          className="-mr-1 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-fg-bright"
        >
          <CogIcon className="h-4 w-4" />
        </button>
      </div>

      {shown.map((ns) => {
        const active = ns.slug === activeNamespace;
        // Every namespace but the active one is a drop target (you can't move an
        // item into the namespace it already lives in).
        const zone = !active ? dropZone?.(ns.slug) : undefined;
        return (
          <NamespaceRow
            key={ns.slug}
            namespace={ns}
            active={active}
            zone={zone}
            label={l.switchTo(ns.name)}
            onSwitch={() => onSwitch(ns.slug)}
          />
        );
      })}
    </div>
  );
}

function NamespaceRow({
  namespace,
  active,
  zone,
  label,
  onSwitch,
}: {
  namespace: Namespace;
  active: boolean;
  zone: DropZoneProps | undefined;
  label: string;
  onSwitch: () => void;
}) {
  // The pointer is over this row mid-drag (paint the strong drop highlight); or
  // a droppable drag is merely in flight (cue this row as a legal target).
  const over = zone?.isOver ?? false;
  const cued = (zone?.isActive ?? false) && !over;
  const state = over
    ? "cursor-pointer bg-accent/15 text-fg-bright ring-1 ring-accent/40 ring-inset"
    : cued
      ? "cursor-pointer text-fg ring-1 ring-accent/30 ring-inset hover:bg-surface-2 hover:text-fg-bright"
      : active
        ? "cursor-pointer bg-accent/20 font-semibold text-fg-bright shadow-[inset_3px_0_0_var(--color-accent)]"
        : "cursor-pointer text-fg hover:bg-surface-2 hover:text-fg-bright";
  return (
    <button
      ref={zone?.ref}
      type="button"
      aria-current={active ? "page" : undefined}
      aria-label={label}
      onClick={onSwitch}
      className={`flex w-full items-center gap-3 px-5 py-[var(--density-row-py)] text-left text-sm ${state}`}
    >
      <span className={active ? "text-accent" : "text-muted"}>
        <Glyph
          name={namespace.glyph}
          className="h-5 w-5"
          style={namespace.color ? { color: namespace.color } : undefined}
        />
      </span>
      <span className="flex-1 truncate">{namespace.name}</span>
    </button>
  );
}
