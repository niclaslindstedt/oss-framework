// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { CopyButton } from "@niclaslindstedt/oss-framework/components";
import { MarkdownEditor } from "@niclaslindstedt/oss-framework/markdown";
import { SyncStatus } from "@niclaslindstedt/oss-framework/sync";

import { ListAppearancePopover } from "./ListAppearancePopover.tsx";
import { useT } from "./i18n/index.ts";
import type { ChecklistStore } from "./useChecklistStore.ts";
import type { MockSync } from "./useMockSync.ts";

// The note screen — the main view for a `note` list, built from the framework's
// `/markdown` editor in place of the `/checklist` body. It reuses the list
// header (the appearance glyph, the copy / sync glyph buttons) so a note reads
// as the same kind of document as a checklist, then hands the whole writing
// surface to the live-preview `MarkdownEditor`: the app owns the body string and
// where it persists; the framework owns the editing experience.
export function NoteScreen({
  store,
  sync,
  onOpenSyncDetails,
}: {
  store: ChecklistStore;
  sync: MockSync;
  onOpenSyncDetails: () => void;
}) {
  const t = useT();
  const { activeList, setListBody, setListAppearance } = store;

  if (!activeList) return null;
  const body = activeList.body ?? "";

  return (
    <div className="relative mx-auto flex h-full w-full max-w-2xl flex-col px-4 pt-[calc(1.25rem+env(safe-area-inset-top))]">
      <header className="mb-2 flex items-center gap-3 border-b border-line px-1 pb-3">
        <ListAppearancePopover
          list={activeList}
          onChange={(patch) => setListAppearance(activeList.id, patch)}
        />
        <h1 className="min-w-0 flex-1 truncate text-lg font-bold tracking-wide text-fg-bright">
          {activeList.title}
        </h1>
        {/* Copy the note's verbatim Markdown source. */}
        <CopyButton
          value={() => body}
          labels={{ copy: t("note.copyNote"), copied: t("screen.copied") }}
        />
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

      {/* The live-preview editor fills the rest of the screen. Keyed by the list
          id so switching notes remounts the editor (a fresh caret, no carried
          active line) rather than reconciling mid-edit. `focusOnMount={false}`
          opens an existing note fully formatted with the keyboard down until a
          tap; the app persists every keystroke through `setListBody`. */}
      <div className="flex min-h-0 flex-1 flex-col pb-28">
        <MarkdownEditor
          key={activeList.id}
          body={body}
          onChange={(next) => setListBody(activeList.id, next)}
          focusOnMount={false}
          labels={{ startWriting: t("note.startWriting") }}
        />
      </div>
    </div>
  );
}
