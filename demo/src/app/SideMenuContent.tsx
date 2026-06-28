// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

import {
  ArchiveIcon,
  ChecklistIcon,
  CogIcon,
  ExternalLinkIcon,
  FloatingPanel,
  FolderIcon,
  FolderOpenIcon,
  GripIcon,
  HeartIcon,
  HelpCircleIcon,
  InlineEditRow,
  NoteIcon,
  PencilIcon,
  PlusIcon,
  RedoIcon,
  RowActionMenu,
  SearchIcon,
  SparklesIcon,
  SwipeableRow,
  TrashIcon,
  UndoIcon,
  type FloatingPlacement,
} from "@niclaslindstedt/oss-framework/components";
import { Glyph } from "@niclaslindstedt/oss-framework/glyphs";
import {
  NamespaceSwitcher,
  type Namespace,
} from "@niclaslindstedt/oss-framework/namespaces";
import {
  CheckForUpdatesItem,
  type PwaUpdateCheckResult,
} from "@niclaslindstedt/oss-framework/pwa";
import {
  useDragDrop,
  type DragHandleProps,
} from "@niclaslindstedt/oss-framework/sidebar";

import { useT } from "./i18n/index.ts";
import { remaining, type ChecklistStore } from "./useChecklistStore.ts";
import type { List, ListKind } from "./types.ts";

// What a side-menu drag carries (a checklist or a whole folder) and where it
// can land. The framework's `useDragDrop` owns the gesture; these app types are
// the only domain it ever sees — kept here, never in the framework.
type DragItem = { kind: "list" | "folder"; id: string };
type DropTarget =
  | { kind: "folder"; id: string }
  | { kind: "root" }
  | { kind: "namespace"; slug: string }
  | { kind: "archive" };

// A list's menu icon: its picked glyph tinted by its accent colour, or the
// neutral default mark for its kind (a checklist tick, or a note document) when
// it carries no custom appearance. The active row already paints its icon
// `text-accent`, so only an *inactive* row wears the list's own colour — keeping
// the selected row's accent consistent.
function listIcon(list: List, active: boolean) {
  if (!list.glyph) {
    return list.kind === "note" ? (
      <NoteIcon className="h-4 w-4" />
    ) : (
      <ChecklistIcon className="h-4 w-4" />
    );
  }
  return (
    <Glyph
      name={list.glyph}
      className="h-4 w-4"
      style={!active && list.color ? { color: list.color } : undefined}
    />
  );
}

// The About dropdown opens up-and-to-the-left of its footer trigger: the
// framework's `FloatingPanel` flips it above automatically (there's no room
// below at the foot of the drawer) and widens it to at least the trigger.
const ABOUT_PLACEMENT: FloatingPlacement = {
  width: { kind: "min", minPx: 200 },
  anchor: "left",
  coordinateSpace: "viewport",
};

// The "New…" dropdown opens above its action-grid button (there's no room
// below at the foot of the menu) — `FloatingPanel` flips it up automatically —
// and widens to at least the trigger.
const NEW_ITEM_PLACEMENT: FloatingPlacement = {
  width: { kind: "min", minPx: 180 },
  anchor: "left",
  coordinateSpace: "viewport",
};

// The project links surfaced in the footer (Donate) and the About dropdown
// (Source code). A real app reads the donate target from build-time env so a
// blank value can hide the row; the demo hard-codes the framework's own home.
const SOURCE_URL = "https://github.com/niclaslindstedt/oss-framework";
const DONATE_URL = "https://github.com/sponsors/niclaslindstedt";
// The subtitle under the Source row — the framework package's released version,
// inlined at build time (`__APP_VERSION__`, see `vite.config.ts`). A real app
// would feed its own build / version label (a commit hash, a tag) in here.
const BUILD_LABEL = `v${__APP_VERSION__}`;

// The navigation drawer's content — the rows the framework `Sidebar` shell
// frames. This is the app's own navigation (the framework owns only the
// docked/drawer framing around it): the namespace header, the checklist tree
// grouped into folders, the bottom action grid, and the footer. It reproduces
// the real app's side menu pixel for pixel.

type Props = {
  store: ChecklistStore;
  // The workspace the menu's lists belong to — heads the framework
  // `NamespaceSwitcher`, which highlights its row as active.
  activeNamespace: Namespace;
  // Every workspace — the switcher lists them all (tap to switch), and the
  // *other* ones double as drop targets so a checklist or folder can be dragged
  // across into another namespace.
  namespaces: Namespace[];
  // Make a namespace active (tap a switcher row).
  onSwitchNamespace: (slug: string) => void;
  onOpenNamespaces: () => void;
  onOpenSettings: () => void;
  onOpenSearch: () => void;
  // Open the "What's new" dialog (the framework `ChangelogModal`, mounted by
  // `App`) — reached from the About dropdown.
  onOpenChangelog: () => void;
  // Close the drawer after a navigation (a no-op when the sidebar is docked) and
  // return the main area to the checklist view.
  onNavigate: () => void;
  // The active top-level view — highlights the Archive button when it's showing.
  view: "checklist" | "archive";
  // Switch the main area to the Archive page (the Archive button's tap).
  onShowArchive: () => void;
  // PWA update state, threaded from `usePwaUpdate` (here, the demo's simulated
  // stand-in). The footer's "check for updates" row drives them.
  checkingUpdate: boolean;
  updateAvailable: boolean;
  onCheckUpdate: () => Promise<PwaUpdateCheckResult>;
};

export function SideMenuContent({
  store,
  activeNamespace,
  namespaces,
  onSwitchNamespace,
  onOpenNamespaces,
  onOpenSettings,
  onOpenSearch,
  onOpenChangelog,
  onNavigate,
  view,
  onShowArchive,
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
    moveListToFolder,
    moveListToNamespace,
    moveFolderToNamespace,
    setActive,
    undo,
    redo,
    canUndo,
    canRedo,
  } = store;

  // Drag-and-drop wiring. The framework hook tracks the gesture and hit-tests
  // the drop zones; the app says which drops are legal (`canDrop`) and what each
  // one means (`onDrop`) — reparent into a folder or back to the root, hand a
  // checklist / folder to another namespace, or archive it.
  const dnd = useDragDrop<DragItem, DropTarget>({
    canDrop: (drag, target) => {
      switch (target.kind) {
        case "folder": {
          if (drag.kind !== "list") return false; // folders don't nest
          const list = data.lists.find((l) => l.id === drag.id);
          return !!list && list.folderId !== target.id;
        }
        case "root": {
          // Only meaningful for a list currently inside a folder.
          if (drag.kind !== "list") return false;
          const list = data.lists.find((l) => l.id === drag.id);
          return !!list && list.folderId !== null;
        }
        case "namespace":
          return true;
        case "archive":
          return true;
      }
    },
    onDrop: (drag, target) => {
      switch (target.kind) {
        case "folder":
          moveListToFolder(drag.id, target.id);
          break;
        case "root":
          moveListToFolder(drag.id, null);
          break;
        case "namespace":
          if (drag.kind === "list") moveListToNamespace(drag.id, target.slug);
          else moveFolderToNamespace(drag.id, target.slug);
          break;
        case "archive":
          if (drag.kind === "list") archiveList(drag.id);
          else archiveFolder(drag.id);
          break;
      }
    },
  });
  const archiveZone = dnd.dropZone("archive", { kind: "archive" });
  const rootZone = dnd.dropZone("root", { kind: "root" });
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(
    () => new Set(),
  );
  // A new folder isn't created until it's named: the "New folder" action drops
  // an inline editor into the list, and only a non-empty name commits it.
  const [creatingFolder, setCreatingFolder] = useState(false);
  // A new list follows the same pattern: the "New" dropdown (root,
  // `folderId: null`) or a folder's "+" (its id) drops an inline editor in the
  // spot the list will land, and only a non-empty name commits it. `kind`
  // carries which the dropdown picked — a checklist or a note. `null` when no
  // list is being created.
  const [creatingListIn, setCreatingListIn] = useState<{
    folderId: string | null;
    kind: ListKind;
  } | null>(null);
  // The action-grid "New" dropdown (checklist / note), anchored to `newRef` and
  // flipped upward by `FloatingPanel`.
  const [newOpen, setNewOpen] = useState(false);
  const newRef = useRef<HTMLButtonElement>(null);
  // The folder whose name is being edited in place (via its action menu's
  // Rename), or `null` when none is.
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  // The checklist being renamed in place (swipe-left pencil / right-click), or
  // `null` when none is.
  const [renamingListId, setRenamingListId] = useState<string | null>(null);
  // The footer "About" dropdown (What's new / source), anchored to `aboutRef`
  // and flipped upward by `FloatingPanel`.
  const [aboutOpen, setAboutOpen] = useState(false);
  const aboutRef = useRef<HTMLButtonElement>(null);

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

  // Open the inline "name your new list" editor for the given kind. A list
  // created inside a folder needs that folder expanded so the editor is visible,
  // so un-collapse it first.
  function beginCreateList(folderId: string | null, kind: ListKind) {
    if (folderId !== null) {
      setCollapsedFolders((prev) => {
        if (!prev.has(folderId)) return prev;
        const next = new Set(prev);
        next.delete(folderId);
        return next;
      });
    }
    setCreatingListIn({ folderId, kind });
  }

  // Commit the inline editor: create the named list of its kind, open it, and
  // close the editor. An empty name is handled by `InlineEditRow` (it cancels
  // instead).
  function commitCreateList(
    folderId: string | null,
    kind: ListKind,
    title: string,
  ) {
    addList(folderId, title, kind);
    setCreatingListIn(null);
    onNavigate();
  }

  // The inline draft editor's icon and placeholder, keyed off which kind the
  // "New" dropdown picked.
  function draftIcon(kind: ListKind) {
    return kind === "note" ? (
      <NoteIcon className="h-4 w-4" />
    ) : (
      <ChecklistIcon className="h-4 w-4" />
    );
  }
  function draftPlaceholder(kind: ListKind) {
    return kind === "note" ? t("menu.noteName") : t("menu.checklistName");
  }

  // One checklist row, in a folder (`indent`) or at the root. Renaming swaps it
  // for the inline editor; otherwise it's a swipeable nav row — swipe left for
  // the pencil + trash strip (rename / delete), swipe right to archive — whose
  // actions a desktop right-click / touch long press reach through
  // `RowActionMenu`, where Archive joins them (the swipe-right commit has no
  // pointer counterpart otherwise).
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
    const renameAction = {
      label: t("menu.renameChecklist"),
      icon: <PencilIcon className="h-5 w-5" />,
      onSelect: () => setRenamingListId(list.id),
    };
    const deleteAction = {
      label: t("menu.deleteChecklist"),
      icon: <TrashIcon className="h-5 w-5" />,
      danger: true,
      onSelect: () => deleteList(list.id),
    };
    // The swipe-left strip stays rename / delete (swipe-right commits archive);
    // the long-press / right-click menu also carries Archive, since a pointer
    // never gets the swipe-right gesture.
    const actions = [renameAction, deleteAction];
    const menuActions = [
      renameAction,
      {
        label: t("menu.archive"),
        icon: <ArchiveIcon className="h-5 w-5" />,
        onSelect: () => archiveList(list.id),
      },
      deleteAction,
    ];
    return (
      <DraggableRow
        key={list.id}
        handle={dnd.dragHandle({ kind: "list", id: list.id })}
        handleLabel={t("menu.dragToMove")}
      >
        <RowActionMenu
          ariaLabel={t("menu.checklistActions")}
          actions={menuActions}
        >
          <SwipeableRow
            actions={actions}
            leading={{
              kind: "commit",
              onCommit: () => archiveList(list.id),
              label: t("menu.archive"),
              icon: <ArchiveIcon className="h-5 w-5" />,
            }}
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
      </DraggableRow>
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
      {/* Namespace switcher — fixed. The framework component owns the
          collapsible section, the switchable rows, and the per-row drop targets
          (a checklist or folder dragged onto another workspace's row moves into
          it). A live drag springs the section open so every workspace is
          reachable; the cog opens the full namespaces manager. */}
      <NamespaceSwitcher
        namespaces={namespaces}
        activeNamespace={activeNamespace.slug}
        onSwitch={(slug) => {
          onSwitchNamespace(slug);
          onNavigate();
        }}
        onManage={onOpenNamespaces}
        dragging={dnd.dragging !== null}
        dropZone={(slug) =>
          dnd.dropZone(`ns:${slug}`, { kind: "namespace", slug })
        }
        labels={{
          heading: t("menu.namespaces"),
          manage: t("namespaces.open"),
          switchTo: (name) => t("menu.switchToNamespace", { name }),
          expand: t("menu.showNamespaces"),
          collapse: t("menu.hideNamespaces"),
        }}
      />

      <SectionHeader label={t("menu.checklists")} border />

      {/* Scrolling list region — also the "root" drop target: dropping a list
          dragged out of a folder here un-groups it. */}
      <div
        ref={rootZone.ref}
        className={`flex min-h-0 flex-1 flex-col overflow-y-auto transition-colors ${
          // An inset `outline` (not a `ring`/`box-shadow`, which paints behind
          // the rows' opaque backgrounds) frames the whole ungrouped region on
          // top of its rows, so a checklist dragged out of a folder reads "drop
          // here to ungroup" even when the pointer is over an opaque list row.
          rootZone.isOver
            ? "bg-accent/10 [outline:2px_solid_var(--color-accent)] [outline-offset:-2px]"
            : ""
        }`}
      >
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
          // right to archive; a desktop right-click / a touch long press reach
          // those through `RowActionMenu`, where Archive joins them (the
          // swipe-right commit has no pointer counterpart otherwise).
          const renameFolderAction = {
            label: t("menu.renameFolder"),
            icon: <PencilIcon className="h-5 w-5" />,
            onSelect: () => setRenamingFolderId(folder.id),
          };
          const deleteFolderAction = {
            label: t("menu.deleteFolder"),
            icon: <TrashIcon className="h-5 w-5" />,
            danger: true,
            onSelect: () => deleteFolder(folder.id),
          };
          const folderActions = [renameFolderAction, deleteFolderAction];
          const folderMenuActions = [
            renameFolderAction,
            {
              label: t("menu.archive"),
              icon: <ArchiveIcon className="h-5 w-5" />,
              onSelect: () => archiveFolder(folder.id),
            },
            deleteFolderAction,
          ];
          const folderZone = dnd.dropZone(`folder:${folder.id}`, {
            kind: "folder",
            id: folder.id,
          });
          return (
            <div key={folder.id} ref={folderZone.ref}>
              <DraggableRow
                handle={dnd.dragHandle({ kind: "folder", id: folder.id })}
                handleLabel={t("menu.dragToMove")}
              >
                <RowActionMenu
                  ariaLabel={t("menu.folderActions")}
                  actions={folderMenuActions}
                >
                  <SwipeableRow
                    actions={folderActions}
                    leading={{
                      kind: "commit",
                      onCommit: () => archiveFolder(folder.id),
                      label: t("menu.archive"),
                      icon: <ArchiveIcon className="h-5 w-5" />,
                    }}
                    highlighted={folderZone.isOver}
                  >
                    <FolderRow
                      name={folder.name}
                      addLabel={t("menu.newChecklistIn", { name: folder.name })}
                      count={lists.length}
                      expanded={expanded}
                      onToggle={() => toggleFolder(folder.id)}
                      onAdd={() => beginCreateList(folder.id, "checklist")}
                    />
                  </SwipeableRow>
                </RowActionMenu>
              </DraggableRow>
              {expanded && (
                <>
                  {lists.map((list) => renderList(list, true))}
                  {creatingListIn?.folderId === folder.id && (
                    <ListEditRow
                      indent
                      initial=""
                      icon={draftIcon(creatingListIn.kind)}
                      placeholder={draftPlaceholder(creatingListIn.kind)}
                      onCommit={(title) =>
                        commitCreateList(folder.id, creatingListIn.kind, title)
                      }
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
            icon={draftIcon(creatingListIn.kind)}
            placeholder={draftPlaceholder(creatingListIn.kind)}
            onCommit={(title) =>
              commitCreateList(null, creatingListIn.kind, title)
            }
            onCancel={() => setCreatingListIn(null)}
          />
        )}
      </div>

      {/* Action grid — fixed. */}
      <div className="shrink-0 px-3 pt-2 pb-3">
        <div className="divide-y divide-line overflow-hidden rounded-md border border-line">
          <div className="flex divide-x divide-line">
            <BarButton
              buttonRef={newRef}
              label={t("menu.newItem")}
              onClick={() => setNewOpen((v) => !v)}
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
              label={dnd.dragging ? t("menu.dropToArchive") : t("menu.archive")}
              badge={archivedCount > 0 ? String(archivedCount) : undefined}
              onClick={onShowArchive}
              current={view === "archive"}
              dropRef={archiveZone.ref}
              over={archiveZone.isOver}
              active={archiveZone.isActive}
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

      {/* Footer — fixed. Donate (an external link), an About dropdown that
          folds away the project links, the framework's "check for updates"
          row, and Settings pinned last under the thumb. */}
      <div className="flex shrink-0 flex-col border-t border-line [padding-top:calc(1.25rem-var(--density-row-py))]">
        <FooterLink
          icon={<HeartIcon className="h-5 w-5 text-danger" />}
          href={DONATE_URL}
          external
        >
          {t("menu.donate")}
        </FooterLink>
        {/* About: a single row that reveals the project links in an upward-
            flipping dropdown — there's no room below at the foot of the drawer.
            It reads as a plain footer row (no chevron) and just toggles the
            panel. */}
        <button
          ref={aboutRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={aboutOpen}
          onClick={() => setAboutOpen((v) => !v)}
          className="flex w-full cursor-pointer items-center gap-3 px-5 py-[var(--density-row-py)] text-left text-sm text-fg hover:bg-surface-2 hover:text-fg-bright"
        >
          <span className="text-muted">
            <HelpCircleIcon className="h-5 w-5" />
          </span>
          <span className="flex-1">{t("menu.about")}</span>
        </button>
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

      {/* The About dropdown itself — portalled and positioned by the framework
          `FloatingPanel`, which owns the flip-up placement, the Escape /
          outside-click dismissal, and focus restoration. "What's new" opens the
          changelog dialog; "Source code" is an external link with the build
          label as its subtitle. */}
      <FloatingPanel
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        triggerRef={aboutRef}
        placement={ABOUT_PLACEMENT}
        className="py-1"
      >
        <FooterRow
          icon={<SparklesIcon className="h-5 w-5" />}
          onClick={() => {
            setAboutOpen(false);
            onOpenChangelog();
          }}
        >
          {t("menu.whatsNew")}
        </FooterRow>
        <FooterLink
          icon={<ExternalLinkIcon className="h-5 w-5" />}
          href={SOURCE_URL}
          sublabel={BUILD_LABEL}
          external
          onClick={() => setAboutOpen(false)}
        >
          {t("menu.source")}
        </FooterLink>
      </FloatingPanel>

      {/* The "New" dropdown — pressing the action-grid "+" opens this above the
          button (`FloatingPanel` flips it up), offering a checklist or a note.
          Picking one drops the inline name editor for that kind in place. */}
      <FloatingPanel
        open={newOpen}
        onClose={() => setNewOpen(false)}
        triggerRef={newRef}
        placement={NEW_ITEM_PLACEMENT}
        className="py-1"
      >
        <FooterRow
          icon={<ChecklistIcon className="h-5 w-5" />}
          onClick={() => {
            setNewOpen(false);
            beginCreateList(null, "checklist");
          }}
        >
          {t("menu.newChecklist")}
        </FooterRow>
        <FooterRow
          icon={<NoteIcon className="h-5 w-5" />}
          onClick={() => {
            setNewOpen(false);
            beginCreateList(null, "note");
          }}
        >
          {t("menu.newNote")}
        </FooterRow>
      </FloatingPanel>

      {/* The cursor-following label of whatever's mid-drag — portalled to the
          body so it rides above the drawer and isn't clipped by the panel. */}
      {dnd.dragging && (
        <DragPreview
          item={dnd.dragging}
          pointer={dnd.pointer}
          lists={data.lists}
          folders={data.folders}
        />
      )}
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
        indent ? "pr-5 pl-14" : "px-5"
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
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-[var(--density-row-py)] pr-1 pl-5 text-left text-fg hover:text-fg-bright"
      >
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
// double-fire guard; this wrapper supplies only the folder chrome — the folder
// icon and the row's padding, aligned with the live folder rows' glyphs.
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
      className="gap-3 pr-2 pl-5"
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
      className={`gap-3 ${indent ? "pr-5 pl-14" : "px-5"}`}
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
  current,
  dropRef,
  over,
  active,
  buttonRef,
}: {
  children: ReactNode;
  label: string;
  badge?: string;
  disabled?: boolean;
  onClick?: () => void;
  // Marks the button as the open view (Archive while the Archive page shows) —
  // a steady accent tint, distinct from the transient drop-zone highlight.
  current?: boolean;
  // When this button doubles as a drop zone (Archive): the framework ref, and
  // whether a droppable drag is in flight (`active`) / hovering it (`over`).
  dropRef?: (el: HTMLElement | null) => void;
  over?: boolean;
  active?: boolean;
  // Anchors a `FloatingPanel` to this button (the "New" dropdown trigger).
  buttonRef?: RefObject<HTMLButtonElement | null>;
}) {
  // A live drag's drop-zone feedback wins over the resting "current view" tint
  // so the user can see where a dropped item will land.
  const dropState = over
    ? "bg-accent/30 text-fg-bright"
    : active
      ? "text-accent ring-1 ring-accent/40 ring-inset"
      : current
        ? "bg-accent/20 text-fg-bright"
        : "";
  return (
    <button
      ref={buttonRef ?? dropRef}
      type="button"
      aria-label={label}
      aria-pressed={current}
      disabled={disabled}
      onClick={onClick}
      className={`relative flex flex-1 items-center justify-center py-2.5 transition-colors ${
        disabled
          ? "cursor-not-allowed text-muted opacity-40"
          : "cursor-pointer text-fg hover:bg-surface-2 hover:text-fg-bright"
      } ${dropState}`}
    >
      <span className={over || current ? "text-fg-bright" : "text-muted"}>
        {children}
      </span>
      {badge !== undefined && (
        <span className="absolute top-0.5 right-0.5 rounded-full bg-surface-3 px-1 py-0.5 text-[10px] leading-none text-muted tabular-nums">
          {badge}
        </span>
      )}
    </button>
  );
}

// A draggable row: the framework grab handle laid over the row's leading edge
// (faint at rest, brighter on hover) with the existing row content untouched
// behind it. The handle sits *outside* the row's own button/swipe layers, so a
// drag never trips the row's tap or its swipe gesture, and owns the pointer for
// the duration (the framework hook captures it).
function DraggableRow({
  handle,
  handleLabel,
  children,
}: {
  handle: DragHandleProps;
  handleLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="group relative">
      <span
        {...handle}
        role="button"
        aria-label={handleLabel}
        // Opt the row out of the drawer's swipe-to-close while a finger is on
        // the handle — the handle owns this gesture.
        data-drawer-swipe-ignore
        className="absolute inset-y-0 left-0 z-10 flex w-5 cursor-grab touch-none items-center justify-center text-muted opacity-30 group-hover:opacity-70"
      >
        <GripIcon className="h-4 w-4" />
      </span>
      {children}
    </div>
  );
}

// The cursor-following drag preview — the dragged checklist's / folder's icon
// and name, portalled to the body so it floats above everything.
function DragPreview({
  item,
  pointer,
  lists,
  folders,
}: {
  item: DragItem;
  pointer: { x: number; y: number } | null;
  lists: List[];
  folders: { id: string; name: string }[];
}) {
  if (!pointer) return null;
  const list =
    item.kind === "list" ? lists.find((l) => l.id === item.id) : null;
  const folder =
    item.kind === "folder" ? folders.find((f) => f.id === item.id) : null;
  const label = list ? list.title : (folder?.name ?? "");
  const icon = list ? (
    listIcon(list, false)
  ) : (
    <FolderIcon className="h-4 w-4" />
  );
  return createPortal(
    <div
      className="pointer-events-none fixed z-[60] flex max-w-[14rem] items-center gap-2 rounded-md border border-line bg-surface-2 px-3 py-1.5 text-sm text-fg-bright shadow-lg"
      style={{ left: pointer.x + 14, top: pointer.y + 14 }}
    >
      <span className="text-muted">{icon}</span>
      <span className="truncate">{label}</span>
    </div>,
    document.body,
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

// The link sibling of `FooterRow` — an anchor instead of a button, with an
// optional subtitle (the Source row's build label) and an external-link affordance
// (a new tab + the trailing glyph). Shares the row look so the donate link, the
// About toggle, and the dropdown items all read as one footer family.
function FooterLink({
  children,
  icon,
  href,
  sublabel,
  external,
  onClick,
}: {
  children: ReactNode;
  icon: ReactNode;
  href: string;
  sublabel?: string;
  external?: boolean;
  onClick?: () => void;
}) {
  return (
    <a
      href={href}
      onClick={onClick}
      {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
      className="flex w-full cursor-pointer items-center gap-3 px-5 py-[var(--density-row-py)] text-left text-sm text-fg hover:bg-surface-2 hover:text-fg-bright"
    >
      <span className="text-muted">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{children}</span>
        {sublabel && (
          <span className="truncate text-xs text-muted">{sublabel}</span>
        )}
      </span>
      {external && <ExternalLinkIcon className="h-4 w-4 shrink-0 text-muted" />}
    </a>
  );
}
