// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  ArchiveIcon,
  ChecklistIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CogIcon,
  FolderIcon,
  FolderOpenIcon,
  HeartIcon,
  HelpCircleIcon,
  PencilIcon,
  PlusIcon,
  RedoIcon,
  RowActionMenu,
  SearchIcon,
  UndoIcon,
} from "@niclaslindstedt/oss-framework/components";
import { Glyph } from "@niclaslindstedt/oss-framework/glyphs";
import type { Namespace } from "@niclaslindstedt/oss-framework/namespaces";

import { useT } from "./i18n/index.ts";
import { remaining, type ChecklistStore } from "./useChecklistStore.ts";
import type { List } from "./types.ts";

// A list's menu icon: its picked glyph tinted by its accent colour, or the
// neutral checklist mark when it carries no custom appearance. The active row
// already paints its icon `text-accent`, so only an *inactive* row wears the
// list's own colour — keeping the selected row's accent consistent.
function listIcon(list: List, active: boolean) {
  if (!list.glyph) return <ChecklistIcon className="h-4 w-4" />;
  return (
    <Glyph
      name={list.glyph}
      className="h-4 w-4"
      style={!active && list.color ? { color: list.color } : undefined}
    />
  );
}

// The navigation drawer's content — the rows the framework `Sidebar` shell
// frames. This is the app's own navigation (the framework owns only the
// docked/drawer framing around it): the namespace header, the checklist tree
// grouped into folders, the bottom action grid, and the footer. It reproduces
// the real app's side menu pixel for pixel.

type Props = {
  store: ChecklistStore;
  // The workspace the menu's lists belong to — its glyph + name head the menu,
  // and tapping the header (or the cog) opens the namespaces manager.
  activeNamespace: Namespace;
  onOpenNamespaces: () => void;
  onOpenSettings: () => void;
  // Close the drawer after a navigation (a no-op when the sidebar is docked).
  onNavigate: () => void;
};

export function SideMenuContent({
  store,
  activeNamespace,
  onOpenNamespaces,
  onOpenSettings,
  onNavigate,
}: Props) {
  const t = useT();
  const {
    data,
    addList,
    addFolder,
    renameFolder,
    setActive,
    undo,
    redo,
    canUndo,
    canRedo,
  } = store;
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(
    () => new Set(),
  );
  // A new folder isn't created until it's named: the "New folder" action drops
  // an inline editor into the list, and only a non-empty name commits it.
  const [creatingFolder, setCreatingFolder] = useState(false);
  // The folder whose name is being edited in place (via its action menu's
  // Rename), or `null` when none is.
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);

  function toggleFolder(id: string) {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function pick(id: string) {
    setActive(id);
    onNavigate();
  }

  const standalone = data.lists.filter((l) => l.folderId === null);

  return (
    <div className="flex h-full flex-col select-none">
      {/* Namespace section — fixed. The header is a switcher: it shows the
          active workspace's glyph + name and opens the namespaces manager
          (create / switch / rename / restyle / delete). */}
      <div className="shrink-0">
        <SectionHeader
          label={t("menu.namespace")}
          addLabel={t("namespaces.open")}
          addIcon={<CogIcon className="h-4 w-4" />}
          onAdd={onOpenNamespaces}
        />
        <NavRow
          active
          onClick={onOpenNamespaces}
          icon={
            <Glyph
              name={activeNamespace.glyph}
              className="h-5 w-5"
              style={
                activeNamespace.color
                  ? { color: activeNamespace.color }
                  : undefined
              }
            />
          }
        >
          <span className="flex-1 truncate">{activeNamespace.name}</span>
          <ChevronDownIcon className="h-4 w-4 shrink-0 text-muted" />
        </NavRow>
      </div>

      <SectionHeader label={t("menu.checklists")} border />

      {/* Scrolling list region. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {/* A fresh, unnamed folder editor — committing it creates the folder,
            defocusing it empty (or Escape) discards it. */}
        {creatingFolder && (
          <FolderEditRow
            placeholder={t("menu.folderName")}
            onCommit={(name) => {
              addFolder(name);
              setCreatingFolder(false);
            }}
            onCancel={() => setCreatingFolder(false)}
          />
        )}
        {data.folders.map((folder) => {
          const lists = data.lists.filter((l) => l.folderId === folder.id);
          const expanded = !collapsedFolders.has(folder.id);
          // Renaming swaps the folder's row for the same inline editor, seeded
          // with its current name.
          if (renamingFolderId === folder.id) {
            return (
              <FolderEditRow
                key={folder.id}
                initial={folder.name}
                placeholder={t("menu.folderName")}
                onCommit={(name) => {
                  renameFolder(folder.id, name);
                  setRenamingFolderId(null);
                }}
                onCancel={() => setRenamingFolderId(null)}
              />
            );
          }
          return (
            <div key={folder.id}>
              {/* A long press (touch) or right-click (desktop) on the folder
                  row opens its action menu — today just Rename. */}
              <RowActionMenu
                ariaLabel={t("menu.folderActions")}
                actions={[
                  {
                    label: t("menu.renameFolder"),
                    icon: <PencilIcon className="h-5 w-5" />,
                    onSelect: () => setRenamingFolderId(folder.id),
                  },
                ]}
              >
                <FolderRow
                  name={folder.name}
                  addLabel={t("menu.newChecklistIn", { name: folder.name })}
                  count={lists.length}
                  expanded={expanded}
                  onToggle={() => toggleFolder(folder.id)}
                  onAdd={() => {
                    addList(folder.id);
                    onNavigate();
                  }}
                />
              </RowActionMenu>
              {expanded &&
                lists.map((list) => (
                  <NavRow
                    key={list.id}
                    indent
                    active={list.id === data.activeListId}
                    icon={listIcon(list, list.id === data.activeListId)}
                    onClick={() => pick(list.id)}
                  >
                    <span className="flex-1 truncate">{list.title}</span>
                    <RowBadge value={remaining(list)} />
                  </NavRow>
                ))}
            </div>
          );
        })}

        {standalone.map((list) => (
          <NavRow
            key={list.id}
            active={list.id === data.activeListId}
            icon={listIcon(list, list.id === data.activeListId)}
            onClick={() => pick(list.id)}
          >
            <span className="flex-1 truncate">{list.title}</span>
            <RowBadge value={remaining(list)} />
          </NavRow>
        ))}
      </div>

      {/* Action grid — fixed. */}
      <div className="shrink-0 px-3 pt-2 pb-3">
        <div className="divide-y divide-line overflow-hidden rounded-md border border-line">
          <div className="flex divide-x divide-line">
            <BarButton
              label={t("menu.newChecklist")}
              onClick={() => {
                addList(null);
                onNavigate();
              }}
            >
              <PlusIcon className="h-5 w-5" />
            </BarButton>
            <BarButton
              label={t("menu.newFolder")}
              onClick={() => setCreatingFolder(true)}
            >
              <FolderIcon className="h-5 w-5" />
            </BarButton>
            <BarButton label={t("menu.archive")} badge="13">
              <ArchiveIcon className="h-5 w-5" />
            </BarButton>
          </div>
          <div className="flex divide-x divide-line">
            <BarButton
              label={t("menu.undo")}
              disabled={!canUndo}
              onClick={undo}
            >
              <UndoIcon className="h-5 w-5" />
            </BarButton>
            <BarButton
              label={t("menu.redo")}
              disabled={!canRedo}
              onClick={redo}
            >
              <RedoIcon className="h-5 w-5" />
            </BarButton>
            <BarButton label={t("menu.search")}>
              <SearchIcon className="h-5 w-5" />
            </BarButton>
          </div>
        </div>
      </div>

      {/* Footer — fixed. */}
      <div className="flex shrink-0 flex-col border-t border-line [padding-top:calc(1.25rem-var(--density-row-py))]">
        <FooterRow icon={<HeartIcon className="h-5 w-5 text-danger" />}>
          {t("menu.donate")}
        </FooterRow>
        <FooterRow icon={<HelpCircleIcon className="h-5 w-5" />}>
          {t("menu.about")}
        </FooterRow>
        <FooterRow
          icon={<CogIcon className="h-5 w-5" />}
          onClick={onOpenSettings}
        >
          {t("menu.settings")}
        </FooterRow>
      </div>
    </div>
  );
}

// --- rows ------------------------------------------------------------------

function SectionHeader({
  label,
  addLabel,
  border,
  addIcon,
  onAdd,
}: {
  label: string;
  addLabel?: string;
  border?: boolean;
  addIcon?: ReactNode;
  onAdd?: () => void;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-2 px-5 pt-3 pb-1 ${
        border ? "border-t border-line" : ""
      }`}
    >
      <span className="text-xs font-semibold tracking-wide text-muted uppercase">
        {label}
      </span>
      {addIcon && (
        <button
          type="button"
          onClick={onAdd}
          aria-label={addLabel ?? label}
          className="-mr-1 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-fg-bright"
        >
          {addIcon}
        </button>
      )}
    </div>
  );
}

function NavRow({
  children,
  icon,
  active,
  indent,
  onClick,
}: {
  children: ReactNode;
  icon: ReactNode;
  active?: boolean;
  indent?: boolean;
  onClick?: () => void;
}) {
  const state = active
    ? "bg-accent/20 font-semibold text-fg-bright shadow-[inset_3px_0_0_var(--color-accent)]"
    : "text-fg hover:bg-surface-2 hover:text-fg-bright";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center gap-3 py-[var(--density-row-py)] text-left text-sm ${
        indent ? "pr-5 pl-10" : "px-5"
      } ${state}`}
    >
      <span className={`shrink-0 ${active ? "text-accent" : "text-muted"}`}>
        {icon}
      </span>
      {children}
    </button>
  );
}

function FolderRow({
  name,
  addLabel,
  count,
  expanded,
  onToggle,
  onAdd,
}: {
  name: string;
  addLabel: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex w-full min-w-0 items-center">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-[var(--density-row-py)] pr-1 pl-3 text-left text-fg hover:text-fg-bright"
      >
        <span className="text-muted">
          {expanded ? (
            <ChevronDownIcon className="h-4 w-4" />
          ) : (
            <ChevronRightIcon className="h-4 w-4" />
          )}
        </span>
        <span className={expanded ? "text-accent" : "text-muted"}>
          {expanded ? (
            <FolderOpenIcon className="h-5 w-5" />
          ) : (
            <FolderIcon className="h-5 w-5" />
          )}
        </span>
        <span className="flex-1 truncate">{name}</span>
        <RowBadge value={count} />
      </button>
      <button
        type="button"
        onClick={onAdd}
        aria-label={addLabel}
        className="mr-1 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-fg-bright"
      >
        <PlusIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

// The inline folder name editor, used both for creating a folder (empty) and
// renaming one (seeded with its name). Committing on Enter or blur with a
// non-empty trimmed name; an empty name (or Escape) cancels — which is what
// makes a freshly-added, never-named folder simply vanish on defocus. The
// `committed` latch stops the blur that follows an Enter from firing twice.
function FolderEditRow({
  initial = "",
  placeholder,
  onCommit,
  onCancel,
}: {
  initial?: string;
  placeholder: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [committed, setCommitted] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  // Focus (and select) on mount without the a11y-flagged `autoFocus` prop —
  // the row only appears on an explicit "new folder" / "rename" action, so it
  // takes focus the moment it shows.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);
  function finish() {
    if (committed) return;
    setCommitted(true);
    const name = value.trim();
    if (name) onCommit(name);
    else onCancel();
  }
  return (
    <div className="flex items-center gap-2 py-[var(--density-row-py)] pr-2 pl-3">
      {/* A chevron-sized spacer (no chevron — a brand-new folder can't be
          expanded) keeps the folder glyph aligned with the existing folders'
          glyphs, which sit one notch right of their chevron. */}
      <span className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="text-muted">
        <FolderIcon className="h-5 w-5" />
      </span>
      <input
        ref={ref}
        type="text"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onBlur={finish}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            finish();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setCommitted(true);
            onCancel();
          }
        }}
        className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-fg-bright outline-none placeholder:text-muted/60"
      />
    </div>
  );
}

function RowBadge({ value }: { value: number }) {
  if (value <= 0) return null;
  return (
    <span className="shrink-0 rounded-full bg-surface-3 px-2 py-0.5 text-xs text-muted tabular-nums">
      {value}
    </span>
  );
}

function BarButton({
  children,
  label,
  badge,
  disabled,
  onClick,
}: {
  children: ReactNode;
  label: string;
  badge?: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`relative flex flex-1 items-center justify-center py-2.5 ${
        disabled
          ? "cursor-not-allowed text-muted opacity-40"
          : "cursor-pointer text-fg hover:bg-surface-2 hover:text-fg-bright"
      }`}
    >
      <span className="text-muted">{children}</span>
      {badge !== undefined && (
        <span className="absolute top-0.5 right-0.5 rounded-full bg-surface-3 px-1 py-0.5 text-[10px] leading-none text-muted tabular-nums">
          {badge}
        </span>
      )}
    </button>
  );
}

function FooterRow({
  children,
  icon,
  onClick,
}: {
  children: ReactNode;
  icon: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-3 px-5 py-[var(--density-row-py)] text-left text-sm text-fg hover:bg-surface-2 hover:text-fg-bright"
    >
      <span className="text-muted">{icon}</span>
      <span className="flex-1">{children}</span>
    </button>
  );
}
