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
  PlusIcon,
  RedoIcon,
  SearchIcon,
  UndoIcon,
} from "@niclaslindstedt/oss-framework/components";

import { remaining, type ChecklistStore } from "./useChecklistStore.ts";

// The navigation drawer's content — the rows the framework `Sidebar` shell
// frames. This is the app's own navigation (the framework owns only the
// docked/drawer framing around it): the namespace header, the checklist tree
// grouped into folders, the bottom action grid, and the footer. It reproduces
// the real app's side menu pixel for pixel.

type Props = {
  store: ChecklistStore;
  onOpenSettings: () => void;
  // Close the drawer after a navigation (a no-op when the sidebar is docked).
  onNavigate: () => void;
};

export function SideMenuContent({ store, onOpenSettings, onNavigate }: Props) {
  const { data, addList, addFolder, setActive, undo, redo, canUndo, canRedo } =
    store;
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(
    () => new Set(),
  );

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
      {/* Namespace section — fixed. */}
      <div className="shrink-0">
        <SectionHeader
          label="Namespace"
          addIcon={<CogIcon className="h-4 w-4" />}
        />
        <NavRow active icon={<FolderIcon className="h-5 w-5" />}>
          <span className="flex-1 truncate">{data.namespace}</span>
        </NavRow>
      </div>

      <SectionHeader label="Checklists" border />

      {/* Scrolling list region. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {data.folders.map((folder) => {
          const lists = data.lists.filter((l) => l.folderId === folder.id);
          const expanded = !collapsedFolders.has(folder.id);
          return (
            <div key={folder.id}>
              <FolderRow
                name={folder.name}
                count={lists.length}
                expanded={expanded}
                onToggle={() => toggleFolder(folder.id)}
                onAdd={() => {
                  addList(folder.id);
                  onNavigate();
                }}
              />
              {expanded &&
                lists.map((list) => (
                  <NavRow
                    key={list.id}
                    indent
                    active={list.id === data.activeListId}
                    icon={<ChecklistIcon className="h-4 w-4" />}
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
            icon={<ChecklistIcon className="h-4 w-4" />}
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
              label="New checklist"
              onClick={() => {
                addList(null);
                onNavigate();
              }}
            >
              <PlusIcon className="h-5 w-5" />
            </BarButton>
            <BarButton label="New folder" onClick={addFolder}>
              <FolderIcon className="h-5 w-5" />
            </BarButton>
            <BarButton label="Archive" badge="13">
              <ArchiveIcon className="h-5 w-5" />
            </BarButton>
          </div>
          <div className="flex divide-x divide-line">
            <BarButton label="Undo" disabled={!canUndo} onClick={undo}>
              <UndoIcon className="h-5 w-5" />
            </BarButton>
            <BarButton label="Redo" disabled={!canRedo} onClick={redo}>
              <RedoIcon className="h-5 w-5" />
            </BarButton>
            <BarButton label="Search">
              <SearchIcon className="h-5 w-5" />
            </BarButton>
          </div>
        </div>
      </div>

      {/* Footer — fixed. */}
      <div className="flex shrink-0 flex-col border-t border-line [padding-top:calc(1.25rem-var(--density-row-py))]">
        <FooterRow icon={<HeartIcon className="h-5 w-5 text-danger" />}>
          Donate
        </FooterRow>
        <FooterRow icon={<HelpCircleIcon className="h-5 w-5" />}>
          About
        </FooterRow>
        <FooterRow
          icon={<CogIcon className="h-5 w-5" />}
          onClick={onOpenSettings}
        >
          Settings
        </FooterRow>
      </div>
    </div>
  );
}

// --- rows ------------------------------------------------------------------

function SectionHeader({
  label,
  border,
  addIcon,
}: {
  label: string;
  border?: boolean;
  addIcon?: ReactNode;
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
          aria-label={`${label} settings`}
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
  count,
  expanded,
  onToggle,
  onAdd,
}: {
  name: string;
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
        aria-label={`New checklist in ${name}`}
        className="mr-1 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-fg-bright"
      >
        <PlusIcon className="h-4 w-4" />
      </button>
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
