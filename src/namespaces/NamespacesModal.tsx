// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Namespace management dialog: create a namespace, switch the active one,
// rename a namespace's display name, restyle its icon / colour, and delete one
// (with its data, which your handler removes). The common "switch namespace"
// path can live in a menu switcher too; this dialog is the full add / rename /
// appearance / delete surface.
//
// Presentational and store-free: your app owns the namespace list and the
// active pointer (see the `namespaces` data helpers) and passes them in along
// with the operations. Every user-facing string injects through `labels` with
// English defaults, so the dialog carries no i18n of its own.

import { useState, type FormEvent } from "react";

import {
  Button,
  CheckIcon,
  ClearableInput,
  CloseIcon,
  ConfirmDialog,
  Modal,
  PencilIcon,
  TrashIcon,
} from "../components/index.ts";
import {
  ColorPalette,
  Glyph,
  GlyphPicker,
  GLYPH_COLORS,
  GLYPH_NAMES,
} from "../glyphs/index.ts";
import {
  DEFAULT_NAMESPACE_SLUG,
  type Namespace,
  type NamespaceAppearance,
} from "./namespaces.ts";

/** Visible strings the dialog needs. All optional — English defaults fill any
 *  you omit. The two `(name) => string` entries interpolate a namespace name. */
export type NamespacesLabels = {
  heading?: string;
  blurb?: string;
  /** Section label for the "create a namespace" form (e.g. "New namespace"). */
  newAction?: string;
  namePlaceholder?: string;
  /** Accessible label for the name inputs. */
  nameLabel?: string;
  create?: string;
  /** Validation message when the name is blank. */
  nameRequired?: string;
  colorLabel?: string;
  glyphLabel?: string;
  /** Label for the "no custom icon" choice in the glyph picker. */
  glyphNone?: string;
  save?: string;
  cancel?: string;
  /** Accessible label for a row's rename (pencil) button. */
  renameAction?: string;
  /** Accessible label for a row's delete (trash) button + the confirm title. */
  deleteAction?: string;
  /** Confirm button text in the delete dialog. */
  delete?: string;
  /** Body of the delete confirmation. */
  deleteConfirm?: (name: string) => string;
  /** Accessible label for a row's switch button. */
  switchTo?: (name: string) => string;
  /** Pill marking the default (undeletable) namespace. */
  defaultBadge?: string;
  /** Accessible label for the header / dialog close buttons. */
  close?: string;
};

const DEFAULTS = {
  heading: "Namespaces",
  blurb:
    "Each namespace keeps its own data. Switch between them, or give one an icon and colour.",
  newAction: "New namespace",
  namePlaceholder: "Namespace name",
  nameLabel: "Namespace name",
  create: "Create",
  nameRequired: "A name is required",
  colorLabel: "Colour",
  glyphLabel: "Icon",
  glyphNone: "No icon",
  save: "Save",
  cancel: "Cancel",
  renameAction: "Rename",
  deleteAction: "Delete namespace",
  delete: "Delete",
  deleteConfirm: (name: string) =>
    `Delete “${name}” and all of its data? This can't be undone.`,
  switchTo: (name: string) => `Switch to ${name}`,
  defaultBadge: "Default",
  close: "Close",
} satisfies Required<NamespacesLabels>;

type Props = {
  open: boolean;
  onClose: () => void;
  namespaces: Namespace[];
  /** Slug of the active namespace (its row is highlighted). */
  activeNamespace: string;
  onSwitch: (slug: string) => void;
  onCreate: (name: string, appearance?: NamespaceAppearance) => void;
  onRename: (slug: string, name: string) => void;
  onSetAppearance: (slug: string, patch: NamespaceAppearance) => void;
  /** Remove the namespace and its data. May be async (the row shows a spinner
   *  while it runs). */
  onRemove: (slug: string) => void | Promise<void>;
  /** Glyph names offered by the picker. Defaults to the framework catalogue. */
  glyphs?: readonly string[];
  /** Accent colours offered by the palette. Defaults to `GLYPH_COLORS`. */
  colors?: readonly string[];
  labels?: NamespacesLabels;
};

export function NamespacesModal({
  open,
  onClose,
  namespaces,
  activeNamespace,
  onSwitch,
  onCreate,
  onRename,
  onSetAppearance,
  onRemove,
  glyphs = GLYPH_NAMES,
  colors = GLYPH_COLORS,
  labels,
}: Props) {
  const l = { ...DEFAULTS, ...labels };
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string | null>(null);
  const [newGlyph, setNewGlyph] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submitCreate = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) {
      setError(l.nameRequired);
      return;
    }
    onCreate(trimmed, { glyph: newGlyph, color: newColor });
    setNewName("");
    setNewColor(null);
    setNewGlyph(null);
    setError(null);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="namespaces-title"
      closeLabel={l.close}
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line bg-surface-3 px-4 py-3">
        <h2
          id="namespaces-title"
          className="text-sm font-bold tracking-wide text-fg-bright"
        >
          {l.heading}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={l.close}
          className="-mr-1 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-fg"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <p className="mb-4 text-xs text-muted">{l.blurb}</p>

        <ul className="flex flex-col gap-1">
          {namespaces.map((ns) => (
            <NamespaceRow
              key={ns.slug}
              namespace={ns}
              active={ns.slug === activeNamespace}
              glyphs={glyphs}
              colors={colors}
              labels={l}
              onSwitch={() => onSwitch(ns.slug)}
              onRename={(name) => onRename(ns.slug, name)}
              onSetAppearance={(patch) => onSetAppearance(ns.slug, patch)}
              onRemove={() => onRemove(ns.slug)}
            />
          ))}
        </ul>

        <form onSubmit={submitCreate} className="mt-5 flex flex-col gap-2">
          <label
            htmlFor="namespace-new"
            className="text-xs font-semibold tracking-wide text-muted uppercase"
          >
            {l.newAction}
          </label>
          <div className="flex items-center gap-2">
            <ClearableInput
              id="namespace-new"
              value={newName}
              onValueChange={(v) => {
                setNewName(v);
                if (error) setError(null);
              }}
              placeholder={l.namePlaceholder}
              aria-label={l.nameLabel}
              wrapperClassName="flex-1 rounded border border-line bg-surface-2 px-2 py-1.5"
            />
            <Button type="submit" variant="primary">
              {l.create}
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-xs text-danger">
              {error}
            </p>
          )}

          {/* Pick the new namespace's colour and icon up front, so it lands
              already badged rather than as a bare default the user has to open
              the editor to skin. The pickers carry a "new namespace" aria
              prefix so their swatches stay distinct from any open edit form's
              identical pickers. */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold tracking-wide text-muted uppercase">
              {l.colorLabel}
            </span>
            <ColorPalette
              colors={colors}
              value={newColor}
              onChange={setNewColor}
              ariaLabelPrefix={`${l.newAction} ${l.colorLabel}`}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold tracking-wide text-muted uppercase">
              {l.glyphLabel}
            </span>
            <GlyphPicker
              glyphs={glyphs}
              value={newGlyph}
              onChange={setNewGlyph}
              tintColor={newColor}
              noneLabel={`${l.newAction} ${l.glyphNone}`}
              ariaLabelPrefix={`${l.newAction} ${l.glyphLabel}`}
            />
          </div>
        </form>
      </div>
    </Modal>
  );
}

function NamespaceRow({
  namespace,
  active,
  glyphs,
  colors,
  labels: l,
  onSwitch,
  onRename,
  onSetAppearance,
  onRemove,
}: {
  namespace: Namespace;
  active: boolean;
  glyphs: readonly string[];
  colors: readonly string[];
  labels: Required<NamespacesLabels>;
  onSwitch: () => void;
  onRename: (name: string) => void;
  onSetAppearance: (patch: NamespaceAppearance) => void;
  onRemove: () => void | Promise<void>;
}) {
  const isDefault = namespace.slug === DEFAULT_NAMESPACE_SLUG;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(namespace.name);
  const [busy, setBusy] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const submitRename = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    onRename(trimmed);
    setEditing(false);
  };

  // The glyph tile shown beside the name: the chosen icon (or the default)
  // painted in the namespace's accent colour when it has one.
  const glyphTile = (
    <Glyph
      name={namespace.glyph}
      className="h-4 w-4"
      style={namespace.color ? { color: namespace.color } : undefined}
    />
  );

  const confirmRemove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onRemove();
    } finally {
      setBusy(false);
      setConfirmingRemove(false);
    }
  };

  if (editing) {
    return (
      <li className="flex flex-col gap-3 rounded border border-line bg-surface-2 px-3 py-3">
        <form onSubmit={submitRename} className="flex items-center gap-2">
          <ClearableInput
            value={draft}
            onValueChange={setDraft}
            aria-label={l.nameLabel}
            wrapperClassName="flex-1"
          />
          <Button type="submit" variant="primary">
            {l.save}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setDraft(namespace.name);
              setEditing(false);
            }}
          >
            {l.cancel}
          </Button>
        </form>

        {/* Appearance applies live as the user picks (it isn't gated behind
            Save, which only governs the name) so a menu glyph and the favicon
            update immediately. */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold tracking-wide text-muted uppercase">
            {l.colorLabel}
          </span>
          <ColorPalette
            colors={colors}
            value={namespace.color ?? null}
            onChange={(color) => onSetAppearance({ color })}
            ariaLabelPrefix={l.colorLabel}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold tracking-wide text-muted uppercase">
            {l.glyphLabel}
          </span>
          <GlyphPicker
            glyphs={glyphs}
            value={namespace.glyph ?? null}
            onChange={(glyph) => onSetAppearance({ glyph })}
            tintColor={namespace.color}
            noneLabel={l.glyphNone}
            ariaLabelPrefix={l.glyphLabel}
          />
        </div>
      </li>
    );
  }

  return (
    <li
      className={`flex items-center gap-2 rounded border px-3 py-2 ${
        active ? "border-accent bg-accent/10" : "border-line bg-surface-2"
      }`}
    >
      <button
        type="button"
        onClick={onSwitch}
        aria-current={active ? "true" : undefined}
        aria-label={l.switchTo(namespace.name)}
        className="flex flex-1 cursor-pointer items-center gap-2 text-left"
      >
        <span className="shrink-0">{glyphTile}</span>
        <span className="w-4 shrink-0 text-accent">
          {active && <CheckIcon className="h-4 w-4" />}
        </span>
        <span
          className={`flex-1 truncate text-sm ${
            active ? "font-bold text-accent" : "text-fg"
          }`}
        >
          {namespace.name}
        </span>
        {isDefault && (
          <span className="rounded-full bg-surface-3 px-2 py-0.5 text-xs text-muted">
            {l.defaultBadge}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={() => {
          setDraft(namespace.name);
          setEditing(true);
        }}
        aria-label={l.renameAction}
        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-3 hover:text-fg"
      >
        <PencilIcon className="h-4 w-4" />
      </button>
      {!isDefault && (
        <button
          type="button"
          onClick={() => setConfirmingRemove(true)}
          disabled={busy}
          aria-label={l.deleteAction}
          className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded text-muted hover:bg-danger/15 hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      )}
      <ConfirmDialog
        open={confirmingRemove}
        title={l.deleteAction}
        description={l.deleteConfirm(namespace.name)}
        confirmLabel={l.delete}
        tone="danger"
        onConfirm={() => void confirmRemove()}
        onCancel={() => setConfirmingRemove(false)}
        labels={{ close: l.close, cancel: l.cancel }}
      />
    </li>
  );
}
