// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useState, type ReactNode } from "react";

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
  InlineEditRow,
  PencilIcon,
  PlusIcon,
  RedoIcon,
  RowActionMenu,
  SearchIcon,
  SwipeableRow,
  TrashIcon,
  UndoIcon,
} from "@niclaslindstedt/oss-framework/components";
import { Glyph } from "@niclaslindstedt/oss-framework/glyphs";
import type { Namespace } from "@niclaslindstedt/oss-framework/namespaces";
import {
  CheckForUpdatesItem,
  type PwaUpdateCheckResult,
} from "@niclaslindstedt/oss-framework/pwa";

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
  onOpenSearch: () => void;
  // Close the drawer after a navigation (a no-op when the sidebar is docked).
  onNavigate: () => void;
  // PWA update state, threaded from `usePwaUpdate` (here, the demo's simulated
  // stand-in). The footer's "check for updates" row drives them.
  checkingUpdate: boolean;
  updateAvailable: boolean;
  onCheckUpdate: () => Promise<PwaUpdateCheckResult>;
};

export function SideMenuContent({
  store,
  activeNamespace,
  onOpenNamespaces,
  onOpenSettings,
  onOpenSearch,
  onNavigate,
  checkingUpdate,
  updateAvailable,
  onCheckUpdate,
}: Props) {
  const t = useT();
  const {
    data,
    addList,
    addFolder,
    renameFolder,
    deleteFolder,
    archiveFolder,
    renameList,
    deleteList,
    archiveList,
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
  // A new checklist follows the same pattern: the "New checklist" action (root,
  // `folderId: null`) or a folder's "+" (its id) drops an inline editor in the
  // spot the list will land, and only a non-empty name commits it. `null` when
  // no list is being created.
  const [creatingListIn, setCreatingListIn] = useState<{
    folderId: string | null;
  } | null>(null);
  // The folder whose name is being edited in place (via its action menu's
  // Rename), or `null` when none is.
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  // The checklist being renamed in place (swipe-left pencil / right-click), or
  // `null` when none is.
  const [renamingListId, setRenamingListId] = useState<string | null>(null);

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

  // Open the inline "name your new checklist" editor. A list created inside a
  // folder needs that folder expanded so the editor is visible, so un-collapse
  // it first.
  function beginCreateList(folderId: string | null) {
    if (folderId !== null) {
      setCollapsedFolders((prev) => {
        if (!prev.has(folderId)) return prev;
        const next = new Set(prev);
        next.delete(folderId);
        return next;
      });
    }
    setCreatingListIn({ folderId });
  }

  // Commit the inline editor: create the named list, open it, and close the
  // editor. An empty name is handled by `InlineEditRow` (it cancels instead).
  function commitCreateList(folderId: string | null, title: string) {
    addList(folderId, title);
    setCreatingListIn(null);
    onNavigate();
  }

  // One checklist row, in a folder (`indent`) or at the root. Renaming swaps it
  // for the inline editor; otherwise it's a swipeable nav row — swipe left for
  // the pencil + trash strip (rename / delete), swipe right to archive — that
  // also exposes the same actions to a desktop right-click via `RowActionMenu`.
  function renderList(list: List, indent: boolean) {
    if (renamingListId === list.id) {
      return (
        <ListEditRow
          key={list.id}
          indent={indent}
          initial={list.title}
          icon={listIcon(list, false)}
          placeholder={t("menu.checklistName")}
          onCommit={(title) => {
            renameList(list.id, title);
            setRenamingListId(null);
          }}
          onCancel={() => setRenamingListId(null)}
        />
      );
    }
    const actions = [
      {
        label: t("menu.renameChecklist"),
        icon: <PencilIcon className="h-5 w-5" />,
        onSelect: () => setRenamingListId(list.id),
      },
      {
        label: t("menu.deleteChecklist"),
        icon: <TrashIcon className="h-5 w-5" />,
        danger: true,
        onSelect: () => deleteList(list.id),
      },
    ];
    return (
      <RowActionMenu
        key={list.id}
        ariaLabel={t("menu.checklistActions")}
        actions={actions}
      >
        <SwipeableRow
          actions={actions}
          onArchive={() => archiveList(list.id)}
          archiveLabel={t("menu.archive")}
        >
          <NavRow
            indent={indent}
            active={list.id === data.activeListId}
            icon={listIcon(list, list.id === data.activeListId)}
            onClick={() => pick(list.id)}
          >
            <span className="flex-1 truncate">{list.title}</span>
            <RowBadge value={remaining(list)} />
          </NavRow>
        </SwipeableRow>
      </RowActionMenu>
    );
  }

  // Archived folders / lists drop out of the menu but stay in the document —
  // the Archive button's badge counts them.
  const folders = data.folders.filter((f) => !f.archived);
  const standalone = data.lists.filter(
    (l) => l.folderId === null && !l.archived,
  );
  const archivedCount =
    data.folders.filter((f) => f.archived).length +
    data.lists.filter((l) => l.archived).length;

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
        {folders.map((folder) => {
          const lists = data.lists.filter(
            (l) => l.folderId === folder.id && !l.archived,
          );
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
          // Swipe left for the pencil + trash strip (rename / delete), swipe
          // right to archive; the same actions back a desktop right-click / a
          // touch long press through `RowActionMenu`.
          const folderActions = [
            {
              label: t("menu.renameFolder"),
              icon: <PencilIcon className="h-5 w-5" />,
              onSelect: () => setRenamingFolderId(folder.id),
            },
            {
              label: t("menu.deleteFolder"),
              icon: <TrashIcon className="h-5 w-5" />,
              danger: true,
              onSelect: () => deleteFolder(folder.id),
            },
          ];
          return (
            <div key={folder.id}>
              <RowActionMenu
                ariaLabel={t("menu.folderActions")}
                actions={folderActions}
              >
                <SwipeableRow
                  actions={folderActions}
                  onArchive={() => archiveFolder(folder.id)}
                  archiveLabel={t("menu.archive")}
                >
                  <FolderRow
                    name={folder.name}
                    addLabel={t("menu.newChecklistIn", { name: folder.name })}
                    count={lists.length}
                    expanded={expanded}
                    onToggle={() => toggleFolder(folder.id)}
                    onAdd={() => beginCreateList(folder.id)}
                  />
                </SwipeableRow>
              </RowActionMenu>
              {expanded && (
                <>
                  {lists.map((list) => renderList(list, true))}
                  {creatingListIn?.folderId === folder.id && (
                    <ListEditRow
                      indent
                      initial=""
                      icon={<ChecklistIcon className="h-4 w-4" />}
                      placeholder={t("menu.checklistName")}
                      onCommit={(title) => commitCreateList(folder.id, title)}
                      onCancel={() => setCreatingListIn(null)}
                    />
                  )}
                </>
              )}
            </div>
          );
        })}

        {standalone.map((list) => renderList(list, false))}
        {creatingListIn?.folderId === null && (
          <ListEditRow
            indent={false}
            initial=""
            icon={<ChecklistIcon className="h-4 w-4" />}
            placeholder={t("menu.checklistName")}
            onCommit={(title) => commitCreateList(null, title)}
            onCancel={() => setCreatingListIn(null)}
          />
        )}
      </div>

      {/* Action grid — fixed. */}
      <div className="shrink-0 px-3 pt-2 pb-3">
        <div className="divide-y divide-line overflow-hidden rounded-md border border-line">
          <div className="flex divide-x divide-line">
            <BarButton
              label={t("menu.newChecklist")}
              onClick={() => beginCreateList(null)}
            >
              <PlusIcon className="h-5 w-5" />
            </BarButton>
            <BarButton
              label={t("menu.newFolder")}
              onClick={() => setCreatingFolder(true)}
            >
              <FolderIcon className="h-5 w-5" />
            </BarButton>
            <BarButton
              label={t("menu.archive")}
              badge={archivedCount > 0 ? String(archivedCount) : undefined}
            >
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
            <BarButton label={t("menu.search")} onClick={onOpenSearch}>
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
        {/* The framework owns the whole row — spinner, "up to date" / "update
            available" feedback, the aria-live wiring — so the demo only feeds
            it the update state and the translated strings. */}
        <CheckForUpdatesItem
          checking={checkingUpdate}
          updateAvailable={updateAvailable}
          onCheck={onCheckUpdate}
          labels={{
            idle: t("menu.checkUpdates"),
            checking: t("menu.checkingUpdates"),
            upToDate: t("menu.upToDate"),
            updateAvailable: t("menu.updateAvailable"),
            unavailable: t("menu.updatesUnavailable"),
          }}
        />
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
// renaming one (seeded with its name). The framework's `InlineEditRow` owns the
// focus-on-mount, the Enter/blur-commits-Escape-cancels semantics, and the
// double-fire guard; this wrapper supplies only the folder chrome — a
// chevron-sized leading spacer (no chevron — a brand-new folder can't be
// expanded) that keeps the folder glyph aligned with the existing folders'
// glyphs, plus the folder icon and the row's padding.
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
  return (
    <InlineEditRow
      initial={initial}
      placeholder={placeholder}
      onCommit={onCommit}
      onCancel={onCancel}
      className="gap-2 pr-2 pl-3"
      leading={<span className="h-4 w-4 shrink-0" aria-hidden="true" />}
      icon={<FolderIcon className="h-5 w-5" />}
      iconClassName="text-muted"
    />
  );
}

// The inline checklist-name editor — the swipe-left / right-click Rename drops
// it in place of the nav row, seeded with the list's title and wearing its own
// icon. Same commit rules as `FolderEditRow` (all owned by `InlineEditRow`);
// this wrapper supplies the list icon and the indent-aware row padding.
function ListEditRow({
  initial,
  indent,
  icon,
  placeholder,
  onCommit,
  onCancel,
}: {
  initial: string;
  indent: boolean;
  icon: ReactNode;
  placeholder: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  return (
    <InlineEditRow
      initial={initial}
      placeholder={placeholder}
      onCommit={onCommit}
      onCancel={onCancel}
      className={`gap-3 ${indent ? "pr-5 pl-10" : "px-5"}`}
      icon={icon}
    />
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
