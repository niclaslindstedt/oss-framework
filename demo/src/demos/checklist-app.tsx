// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useState } from "react";

import {
  Badge,
  Checkbox,
  Fab,
  ArchiveIcon,
  ChecklistIcon,
  CloudCheckIcon,
  CogIcon,
  CopyIcon,
  FolderIcon,
  FolderOpenIcon,
  HeartIcon,
  HelpCircleIcon,
  PlusIcon,
  RedoIcon,
  SearchIcon,
  UndoIcon,
} from "@niclaslindstedt/oss-framework/components";
import {
  Checklist,
  ChecklistProgress,
  countProgress,
  setAllChecked,
  type ChecklistNode,
} from "@niclaslindstedt/oss-framework/checklist";

// The flagship demo: the checklist app screen, rebuilt from the framework's
// shared components so the preview looks exactly like the real apps. The list
// body is the `Checklist` (nested items + child checklists), the header ring is
// `ChecklistProgress`, the create button is the `Fab`, and the side-menu
// preview shows the folder tree from `Badge` + the glyph set. All painted by
// the active theme.

const INITIAL: ChecklistNode[] = [
  { id: "inotyol", label: "Inotyol", checked: false },
  {
    id: "tomater",
    label: "Tomater",
    checked: false,
    children: [
      { id: "körsbär", label: "Körsbärstomater", checked: false },
      { id: "kvist", label: "Kvisttomater", checked: false },
    ],
  },
  { id: "yoghurt", label: "Yoghurt", checked: false },
  { id: "mjölk", label: "Mjölk", checked: false },
];

export function ChecklistAppDemo() {
  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-bold text-fg-bright">Checklist app</h2>
        <p className="text-sm text-muted">
          The real app screen, rebuilt from the framework's{" "}
          <code>/checklist</code> and <code>/components</code> surface — nested
          items, the progress ring, the create button, and the side menu.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ListScreen />
        <SideMenu />
      </div>
    </section>
  );
}

// --- the checklist screen (the list view) -------------------------------

function ListScreen() {
  const [items, setItems] = useState<ChecklistNode[]>(INITIAL);
  const [next, setNext] = useState(1);
  const { checked, total } = countProgress(items);

  function addItem() {
    const id = `new-${next}`;
    setItems((prev) => [
      ...prev,
      { id, label: `Ny vara ${next}`, checked: false },
    ]);
    setNext((n) => n + 1);
  }

  return (
    <PhoneFrame>
      <div className="flex h-full flex-col">
        {/* Header: title checkbox + name, progress ring, copy + sync glyphs. */}
        <header className="flex items-center gap-3 px-4 pt-4 pb-3">
          <Checkbox checked onChange={() => {}} ariaLabel="List" />
          <h3 className="flex-1 truncate text-lg font-bold text-fg-bright">
            Att köpa
          </h3>
          <ChecklistProgress
            checked={checked}
            total={total}
            onCheckAll={() => setItems((p) => setAllChecked(p, true))}
            onUncheckAll={() => setItems((p) => setAllChecked(p, false))}
          />
          <IconButton label="Copy list">
            <CopyIcon className="h-4 w-4" />
          </IconButton>
          <IconButton label="In sync" tone="accent">
            <CloudCheckIcon className="h-4 w-4" />
          </IconButton>
        </header>

        <div className="flex-1 overflow-y-auto border-t border-line px-4">
          <Checklist items={items} onChange={setItems} sinkChecked showGrips />
        </div>

        {/* The create FAB, centered over the screen's bottom. */}
        <div className="flex justify-center py-5">
          <Fab aria-label="Add item" onClick={addItem}>
            <PlusIcon className="h-6 w-6" />
          </Fab>
        </div>
      </div>
    </PhoneFrame>
  );
}

function IconButton({
  children,
  label,
  tone = "neutral",
}: {
  children: React.ReactNode;
  label: string;
  tone?: "neutral" | "accent";
}) {
  const toneClass =
    tone === "accent"
      ? "border-accent/50 text-accent hover:bg-accent/10"
      : "border-line text-muted hover:bg-surface-2 hover:text-fg";
  return (
    <button
      type="button"
      aria-label={label}
      className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border ${toneClass}`}
    >
      {children}
    </button>
  );
}

// --- the side menu (the navigation drawer) ------------------------------

function SideMenu() {
  return (
    <PhoneFrame>
      <div className="flex h-full flex-col p-3 text-sm">
        <div className="flex items-center justify-between px-2 py-2">
          <span className="text-xs font-bold tracking-wide text-muted uppercase">
            ▸ Namespace
          </span>
          <CogIcon className="h-4 w-4 text-muted" />
        </div>

        {/* Active folder row. */}
        <NavRow active>
          <FolderIcon className="h-5 w-5 shrink-0 text-accent" />
          <span className="flex-1 font-bold text-fg-bright">Default</span>
        </NavRow>

        <p className="px-2 py-2 text-xs font-bold tracking-wide text-muted uppercase">
          Checklists
        </p>

        {/* An expanded folder with nested checklists. */}
        <NavRow>
          <FolderOpenIcon className="h-5 w-5 shrink-0 text-muted" />
          <span className="flex-1 text-fg">Packlistor</span>
          <Badge>4</Badge>
          <PlusIcon className="h-4 w-4 text-muted" />
        </NavRow>
        {[
          ["Öjerud", 2],
          ["Packlista", 1],
          ["Att köpa", 3],
          ["Hej", 3],
        ].map(([name, count]) => (
          <NavRow key={name as string} indent>
            <ChecklistIcon className="h-4 w-4 shrink-0 text-muted" />
            <span className="flex-1 text-fg">{name}</span>
            <Badge tone="muted">{count}</Badge>
          </NavRow>
        ))}

        <NavRow>
          <ChecklistIcon className="h-4 w-4 shrink-0 text-muted" />
          <span className="flex-1 text-fg">Hej</span>
          <Badge tone="muted">2</Badge>
        </NavRow>
        <NavRow active>
          <ChecklistIcon className="h-4 w-4 shrink-0 text-accent" />
          <span className="flex-1 font-bold text-fg-bright">Att köpa</span>
          <Badge tone="accent">4</Badge>
        </NavRow>

        <div className="flex-1" />

        {/* The action grid. */}
        <div className="grid grid-cols-3 gap-1.5 border-t border-line pt-3">
          <ActionCell label="New list">
            <PlusIcon className="h-4 w-4" />
          </ActionCell>
          <ActionCell label="New folder">
            <FolderIcon className="h-4 w-4" />
          </ActionCell>
          <ActionCell label="Archive" badge="13">
            <ArchiveIcon className="h-4 w-4" />
          </ActionCell>
          <ActionCell label="Undo">
            <UndoIcon className="h-4 w-4" />
          </ActionCell>
          <ActionCell label="Redo" muted>
            <RedoIcon className="h-4 w-4" />
          </ActionCell>
          <ActionCell label="Search">
            <SearchIcon className="h-4 w-4" />
          </ActionCell>
        </div>

        {/* Footer rows. */}
        <div className="mt-3 flex flex-col gap-1 border-t border-line pt-3">
          <FooterRow icon={<HeartIcon className="h-4 w-4 text-danger" />}>
            Donate
          </FooterRow>
          <FooterRow icon={<HelpCircleIcon className="h-4 w-4 text-muted" />}>
            About
          </FooterRow>
          <FooterRow icon={<CogIcon className="h-4 w-4 text-muted" />}>
            Settings
          </FooterRow>
        </div>
      </div>
    </PhoneFrame>
  );
}

function NavRow({
  children,
  active,
  indent,
}: {
  children: React.ReactNode;
  active?: boolean;
  indent?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-md py-2 ${
        indent ? "pr-2 pl-8" : "px-2"
      } ${active ? "border-l-2 border-accent bg-accent/10" : ""}`}
    >
      {children}
    </div>
  );
}

function ActionCell({
  children,
  label,
  badge,
  muted,
}: {
  children: React.ReactNode;
  label: string;
  badge?: string;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`relative flex h-12 items-center justify-center rounded-md border border-line ${
        muted ? "text-muted/50" : "text-muted hover:bg-surface-2 hover:text-fg"
      }`}
    >
      {children}
      {badge && (
        <span className="absolute top-1 right-1 text-[10px] text-muted">
          {badge}
        </span>
      )}
    </button>
  );
}

function FooterRow({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-2 py-1.5 text-fg">
      {icon}
      {children}
    </div>
  );
}

// A phone-screen frame so the app mock reads as a device, against the page's
// own background.
function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex h-[34rem] w-full max-w-sm overflow-hidden rounded-2xl border border-line bg-page-bg shadow-xl">
      {children}
    </div>
  );
}
