// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useRef, useState } from "react";

import {
  Checkbox,
  ClearableInput,
  Fab,
  CloudCheckIcon,
  CopyIcon,
  PlusIcon,
} from "@niclaslindstedt/oss-framework/components";
import {
  Checklist,
  ChecklistProgress,
  flattenNodes,
  setAllChecked,
} from "@niclaslindstedt/oss-framework/checklist";

import { ListAppearancePopover } from "./ListAppearancePopover.tsx";
import type { ChecklistStore } from "./useChecklistStore.ts";

// The list screen — the app's main view, rebuilt from the framework's
// `/checklist`, `/components`, and `/glyphs` surface so it matches the real
// app: a header with the list's appearance button, its title checkbox, the
// progress ring, and copy / sync glyph buttons; the nested checklist body; and
// the centered create FAB with an inline composer for adding items.
export function ChecklistScreen({ store }: { store: ChecklistStore }) {
  const {
    activeList,
    progress,
    setActiveItems,
    addItem,
    deleteItem,
    setListAppearance,
  } = store;
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the composer when it opens.
  useEffect(() => {
    if (composing) inputRef.current?.focus();
  }, [composing]);

  if (!activeList) return null;

  function commitDraft() {
    if (draft.trim()) {
      addItem(draft);
      setDraft("");
      // Keep the composer open + focused for rapid entry.
      inputRef.current?.focus();
    } else {
      setComposing(false);
    }
  }

  async function copyList() {
    const lines = flattenNodes(activeList!.items)
      .map(
        (n) =>
          `${n.checked ? "[x]" : "[ ]"} ${typeof n.label === "string" ? n.label : ""}`,
      )
      .join("\n");
    try {
      await navigator.clipboard.writeText(`${activeList!.title}\n${lines}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard blocked (insecure context) — no-op for the demo.
    }
  }

  return (
    <div className="relative mx-auto flex h-full w-full max-w-2xl flex-col px-4 pt-[calc(1.25rem+env(safe-area-inset-top))]">
      <header className="mb-2 flex items-center gap-3 border-b border-line px-1 pb-3">
        <ListAppearancePopover
          list={activeList}
          onChange={(patch) => setListAppearance(activeList.id, patch)}
        />
        <Checkbox checked onChange={() => {}} ariaLabel="List" />
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
          labels={{ progress: (c, t) => `${c}/${t}` }}
        />
        <GlyphButton label={copied ? "Copied" : "Copy list"} onClick={copyList}>
          <CopyIcon className="h-4 w-4" />
        </GlyphButton>
        <GlyphButton label="In sync" tone="accent">
          <CloudCheckIcon className="h-4 w-4" />
        </GlyphButton>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto pb-28">
        <Checklist
          items={activeList.items}
          onChange={setActiveItems}
          onDelete={deleteItem}
          sinkChecked
          showGrips
        />

        {composing && (
          <div className="flex items-center gap-3 border-b border-line py-2.5">
            <span aria-hidden className="w-5 shrink-0" />
            <span
              aria-hidden
              className="flex h-5 w-5 shrink-0 rounded-sm border-2 border-muted"
            />
            <div className="flex-1 rounded-md border border-line bg-surface-2 px-2.5 py-1 focus-within:border-accent">
              <ClearableInput
                ref={inputRef}
                value={draft}
                onValueChange={setDraft}
                placeholder="Add an item…"
                clearLabel="Clear"
                className="text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitDraft();
                  if (e.key === "Escape") setComposing(false);
                }}
                onBlur={() => {
                  if (!draft.trim()) setComposing(false);
                }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-[calc(1.5rem+env(safe-area-inset-bottom))] flex justify-center">
        <Fab
          aria-label="Add item"
          className="pointer-events-auto"
          onClick={() => (composing ? commitDraft() : setComposing(true))}
        >
          <PlusIcon className="h-6 w-6" />
        </Fab>
      </div>
    </div>
  );
}

// A bordered square icon button — the copy / sync affordances in the header.
function GlyphButton({
  children,
  label,
  tone = "neutral",
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  tone?: "neutral" | "accent";
  onClick?: () => void;
}) {
  const toneClass =
    tone === "accent"
      ? "border-accent/50 text-accent hover:bg-accent/10"
      : "border-line text-muted hover:bg-surface-2 hover:text-fg";
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border ${toneClass}`}
    >
      {children}
    </button>
  );
}
