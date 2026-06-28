// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useState } from "react";

import {
  ArchiveIcon,
  CopyButton,
  FabMenu,
  PullToRefreshIndicator,
  PlusIcon,
  TrashIcon,
} from "@niclaslindstedt/oss-framework/components";
import {
  useDesktopPointer,
  usePullToRefresh,
} from "@niclaslindstedt/oss-framework/hooks";
import {
  Checklist,
  ChecklistProgress,
  findNode,
  flattenNodes,
  setAllChecked,
} from "@niclaslindstedt/oss-framework/checklist";
import { SyncStatus } from "@niclaslindstedt/oss-framework/sync";

import { ListAppearancePopover } from "./ListAppearancePopover.tsx";
import { RowContextMenu, type RowMenuTarget } from "./RowContextMenu.tsx";
import { useT } from "./i18n/index.ts";
import type { AddItemPosition } from "./useAppSettings.ts";
import type { ChecklistStore } from "./useChecklistStore.ts";
import type { MockSync } from "./useMockSync.ts";

// The list screen — the app's main view, rebuilt from the framework's
// `/checklist`, `/components`, and `/glyphs` surface so it matches the real
// app: a header with the list's appearance glyph, the progress ring, and copy /
// sync glyph buttons; the nested checklist body; and the centered create FAB
// with an inline composer for adding items.
export function ChecklistScreen({
  store,
  sync,
  onOpenSyncDetails,
  addItemPosition,
  trophy,
}: {
  store: ChecklistStore;
  // The app's simulated sync engine — drives the header `SyncStatus` glyph.
  sync: MockSync;
  // Open the framework `SyncDetailsModal` (mounted by the app shell).
  onOpenSyncDetails: () => void;
  // Where the composer drops a new item (Settings → Lists). "Enter on a row"
  // always lands the next item directly below the one you're on.
  addItemPosition: AddItemPosition;
  // The framework `TrophyButton`, slotted into the header by the app shell (or
  // nothing when achievements are switched off). The screen owns the layout;
  // App owns what the button opens.
  trophy?: React.ReactNode;
}) {
  const t = useT();
  const {
    activeList,
    progress,
    setActiveItems,
    addItem,
    deleteItem,
    archiveItem,
    archiveFinishedItems,
    deleteFinishedItems,
    setListAppearance,
    reload,
  } = store;
  // The list's own composer is owned by the framework `Checklist`; this only
  // holds whether the toolbar composer (the one the add FAB opens) is showing.
  const [composing, setComposing] = useState(false);

  // Desktop pointers (mouse / trackpad) have no swipe, so they reach a row's
  // actions through a right-click menu instead — the same Delete the touch
  // swipe latches. Touch devices report a coarse pointer and never arm it.
  const desktopPointer = useDesktopPointer();
  const [rowMenu, setRowMenu] = useState<RowMenuTarget | null>(null);

  // The pull-to-refresh "sync": a local-first app re-checks where its data
  // lives — here, re-reading the persisted document to pick up edits from
  // another tab. The read is synchronous and near-instant; the hook holds its
  // spinner up for its own anti-flicker floor, so the adopter no longer pads
  // the handler with a hand-rolled min-delay. The header `SyncStatus` glyph
  // reflects the *save* lifecycle separately; this is the read side, and
  // tapping the glyph opens the command centre instead.
  const doPull = useCallback(() => {
    reload();
  }, [reload]);

  // Pull down from the top of the list to sync. The hook owns the gesture, its
  // own in-flight guard, and the anti-flicker floor, and gates itself
  // (touch-only, stands down inside a modal, only at scroll-top); the indicator
  // below renders its three states.
  const pull = usePullToRefresh(doPull);

  if (!activeList) return null;

  // Finished (checked, still-live) items — what the FAB's bulk actions sweep.
  const finishedCount = flattenNodes(activeList.items).filter(
    (n) => n.checked && !n.archived,
  ).length;

  // The whole active list as plain task-list markdown, snapshotted when the copy
  // fires (archived items dropped — they're off the live list). `CopyButton`
  // owns the robust clipboard write and the tick flash.
  function listMarkdown() {
    const lines = flattenNodes(activeList.items)
      .filter((n) => !n.archived)
      .map(
        (n) =>
          `${n.checked ? "[x]" : "[ ]"} ${typeof n.label === "string" ? n.label : ""}`,
      )
      .join("\n");
    return `${activeList.title}\n${lines}`;
  }

  return (
    <div className="relative mx-auto flex h-full w-full max-w-2xl flex-col px-4 pt-[calc(1.25rem+env(safe-area-inset-top))]">
      <PullToRefreshIndicator
        state={pull.state}
        pullDistance={pull.pullDistance}
      />
      {rowMenu && (
        <RowContextMenu
          target={rowMenu}
          onClose={() => setRowMenu(null)}
          onDelete={deleteItem}
        />
      )}
      <header className="mb-2 flex items-center gap-3 border-b border-line px-1 pb-3">
        <ListAppearancePopover
          list={activeList}
          onChange={(patch) => setListAppearance(activeList.id, patch)}
        />
        <h1 className="min-w-0 flex-1 truncate text-lg font-bold tracking-wide text-fg-bright">
          {activeList.title}
        </h1>
        <ChecklistProgress
          checked={progress.checked}
          total={progress.total}
          onCheckAll={() =>
            setActiveItems(setAllChecked(activeList.items, true))
          }
          onUncheckAll={() =>
            setActiveItems(setAllChecked(activeList.items, false))
          }
          labels={{ progress: (c, total) => `${c}/${total}` }}
        />
        {trophy}
        <CopyButton
          value={listMarkdown}
          labels={{ copy: t("screen.copyList"), copied: t("screen.copied") }}
        />
        {/* The framework sync glyph — morphs over the engine's save state and
            opens the command centre on tap. The pull-to-refresh gesture above
            stays the read-side "sync"; this is the write-side status. */}
        <SyncStatus
          providerName={sync.providerName}
          status={sync.status}
          dirty={sync.dirty}
          offline={sync.offline}
          onOpenDetails={onOpenSyncDetails}
          labels={{
            saving: t("sync.saving"),
            syncedTo: (name) => t("sync.syncedTo", { name }),
            saveUnsaved: t("sync.saveUnsaved"),
            failed: t("sync.failed"),
            throttled: t("sync.throttled"),
            reauthRequired: t("sync.reauthRequired"),
            syncConflict: t("sync.syncConflict"),
            offline: t("sync.offline"),
          }}
        />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto pb-28">
        <Checklist
          items={activeList.items}
          onChange={setActiveItems}
          onDelete={deleteItem}
          // The app names the right-swipe commit and supplies its glyph; the
          // framework defaults nothing. `isHidden` drops archived rows from the
          // live list (the Archive screen surfaces them).
          swipeAction={{
            onCommit: archiveItem,
            label: t("screen.archive"),
            icon: <ArchiveIcon className="h-5 w-5" />,
          }}
          isHidden={(n) => n.archived === true}
          onAdd={addItem}
          addItemPosition={addItemPosition}
          addPlaceholder={t("screen.addItem")}
          composing={composing}
          onComposingChange={setComposing}
          onRowContextMenu={
            desktopPointer
              ? (id, e) => {
                  const node = findNode(activeList!.items, id);
                  if (!node) return;
                  e.preventDefault();
                  setRowMenu({
                    id,
                    label: typeof node.label === "string" ? node.label : "",
                    x: e.clientX,
                    y: e.clientY,
                  });
                }
              : undefined
          }
          editable
          editPlaceholder={t("screen.editItem")}
          reorderable
          sinkChecked
          showGrips
        />
      </div>

      {/* The add FAB. A tap opens the composer; a long press fans out the bulk
          actions (archive / delete every finished item) the framework `FabMenu`
          owns. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[calc(1.5rem+env(safe-area-inset-bottom))] flex justify-center">
        <div className="pointer-events-auto">
          <FabMenu
            aria-label={t("screen.addItemAria")}
            moreActionsLabel={t("screen.moreActions")}
            onActivate={() => setComposing(true)}
            actions={[
              {
                icon: <ArchiveIcon className="h-6 w-6" />,
                label: t("screen.archiveFinished"),
                onSelect: archiveFinishedItems,
                disabled: finishedCount === 0,
                className: "bg-link text-page-bg",
              },
              {
                icon: <TrashIcon className="h-6 w-6" />,
                label: t("screen.deleteFinished"),
                onSelect: deleteFinishedItems,
                disabled: finishedCount === 0,
                className: "bg-danger text-white",
              },
            ]}
          >
            <PlusIcon className="h-6 w-6" />
          </FabMenu>
        </div>
      </div>
    </div>
  );
}
