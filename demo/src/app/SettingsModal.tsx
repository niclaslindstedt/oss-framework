// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  Button,
  FloatingPanel,
  Modal,
  CloseIcon,
  DatabaseIcon,
  MenuIcon,
  PaletteIcon,
  PencilIcon,
  SlidersIcon,
  type IconProps,
} from "@niclaslindstedt/oss-framework/components";
import {
  AppearancePicker,
  type ThemeAppearance,
} from "@niclaslindstedt/oss-framework/theme";

import { CodeIcon, ScrollTextIcon } from "./icons.tsx";
import { useT } from "./i18n/index.ts";
import { APP_LOOK } from "./look.ts";
import { DEFAULT_SETTINGS, type AppSettings } from "./useAppSettings.ts";
import {
  DeveloperTab,
  EditorTab,
  GeneralTab,
  LogsTab,
  StorageTab,
} from "./settings/tabs.tsx";

// The app's tabbed Settings modal — composed from the framework's `Modal` and
// `FloatingPanel` primitives plus the theme module's `AppearancePicker`. It
// reproduces the real app's settings: a header whose menu button opens the tab
// list, a scrolling tab body, and a Reset / Cancel / Save footer. Edits to the
// appearance preview live; the rest are staged in a draft and only committed on
// Save (Cancel reverts).

type TabId =
  | "general"
  | "appearance"
  | "editor"
  | "storage"
  | "developer"
  | "logs";

// A typed message key (the argument `useT`'s `t` accepts), so each tab's label
// stays a compile-checked catalog path.
type TKey = Parameters<ReturnType<typeof useT>>[0];

type TabDef = {
  id: TabId;
  labelKey: TKey;
  icon: (p: IconProps) => ReactNode;
};

const TABS: TabDef[] = [
  { id: "general", labelKey: "settings.tabs.general", icon: SlidersIcon },
  { id: "appearance", labelKey: "settings.tabs.appearance", icon: PaletteIcon },
  { id: "editor", labelKey: "settings.tabs.editor", icon: PencilIcon },
  { id: "storage", labelKey: "settings.tabs.storage", icon: DatabaseIcon },
  { id: "developer", labelKey: "settings.tabs.developer", icon: CodeIcon },
  { id: "logs", labelKey: "settings.tabs.logs", icon: ScrollTextIcon },
];

type Props = {
  open: boolean;
  onClose: () => void;
  appearance: ThemeAppearance;
  // Live-preview setter — appearance edits paint the whole app immediately.
  setAppearance: (next: ThemeAppearance) => void;
  settings: AppSettings;
  commitSettings: (next: AppSettings) => void;
  // Trigger the page-level PWA update prompt (Developer tab → Software updates).
  onSimulateUpdate: () => void;
  // Replace the active document with a legacy file so the migrator upgrades it
  // live (Developer tab → Document migrations).
  onLoadLegacy: () => void;
};

export function SettingsModal({
  open,
  onClose,
  appearance,
  setAppearance,
  settings,
  commitSettings,
  onSimulateUpdate,
  onLoadLegacy,
}: Props) {
  const t = useT();
  const [tab, setTab] = useState<TabId>("general");
  const [menuOpen, setMenuOpen] = useState(false);
  const [draft, setDraft] = useState<AppSettings>(settings);
  const menuRef = useRef<HTMLButtonElement>(null);
  // The appearance to restore if the user cancels — captured on open.
  const snapshot = useRef<ThemeAppearance>(appearance);

  // On open, snapshot the live appearance and seed the settings draft.
  useEffect(() => {
    if (!open) return;
    snapshot.current = appearance;
    setDraft(settings);
    setTab("general");
    setMenuOpen(false);
    // Only re-run when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  // The Developer / Logs tabs only exist while developer mode (or capture) is
  // on — mirror the real app. If the active tab vanishes, fall back to General.
  const visible = TABS.filter(
    (tabItem) =>
      (tabItem.id !== "developer" || draft.devMode) &&
      (tabItem.id !== "logs" || draft.devMode || draft.captureLogs),
  );
  const activeTab = visible.some((tabItem) => tabItem.id === tab)
    ? tab
    : "general";
  const activeDef =
    visible.find((tabItem) => tabItem.id === activeTab) ?? visible[0]!;
  const ActiveIcon = activeDef.icon;

  function save() {
    commitSettings(draft);
    onClose();
  }
  function cancel() {
    setAppearance(snapshot.current); // discard the live appearance preview
    onClose();
  }
  function reset() {
    setAppearance(APP_LOOK);
    setDraft(DEFAULT_SETTINGS);
  }

  return (
    <Modal
      open={open}
      onClose={cancel}
      labelledBy="settings-title"
      closeLabel={t("common.cancel")}
    >
      {/* Header: tab menu trigger (left) + close (right). */}
      <header className="relative flex shrink-0 items-center justify-between gap-2 border-b border-line bg-surface-3 px-4 py-3">
        <button
          ref={menuRef}
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          id="settings-title"
          className={`-ml-1 inline-flex cursor-pointer items-center gap-2 rounded border px-2 py-1 text-sm font-bold tracking-wide text-fg-bright ${
            menuOpen
              ? "border-accent bg-accent/15"
              : "border-transparent hover:border-line hover:bg-surface-2"
          }`}
        >
          <MenuIcon className="h-[18px] w-[18px] text-muted" />
          <span className="inline-flex shrink-0 text-accent">
            <ActiveIcon className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0">{t(activeDef.labelKey)}</span>
        </button>
        <button
          type="button"
          onClick={cancel}
          aria-label={t("common.close")}
          className="-mr-1 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-fg"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </header>

      <FloatingPanel
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        triggerRef={menuRef}
        placement={{
          width: { kind: "min", minPx: 192 },
          anchor: "left",
          coordinateSpace: "viewport",
        }}
      >
        <div role="menu" className="flex w-full flex-col gap-0.5 p-2">
          {visible.map((tabItem) => {
            const Icon = tabItem.icon;
            const isActive = tabItem.id === activeTab;
            return (
              <button
                key={tabItem.id}
                type="button"
                role="menuitem"
                aria-current={isActive ? "page" : undefined}
                onClick={() => {
                  setTab(tabItem.id);
                  setMenuOpen(false);
                }}
                className={`flex w-full cursor-pointer items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-surface ${
                  isActive ? "font-bold text-accent" : "text-fg"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{t(tabItem.labelKey)}</span>
              </button>
            );
          })}
        </div>
      </FloatingPanel>

      {/* Tab body. */}
      <div className="flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4">
        {activeTab === "general" && (
          <GeneralTab settings={draft} update={update} />
        )}
        {activeTab === "appearance" && (
          <AppearancePicker appearance={appearance} onChange={setAppearance} />
        )}
        {activeTab === "editor" && (
          <EditorTab settings={draft} update={update} />
        )}
        {activeTab === "storage" && <StorageTab />}
        {activeTab === "developer" && (
          <DeveloperTab
            settings={draft}
            update={update}
            onSimulateUpdate={onSimulateUpdate}
            onLoadLegacy={onLoadLegacy}
          />
        )}
        {activeTab === "logs" && <LogsTab />}
      </div>

      {/* Footer: Reset (left) | Cancel + Save (right). Add the bottom
          safe-area inset on top of the normal 0.75rem padding so the buttons
          keep their breathing room and clear the iOS PWA home-indicator /
          curved corners; collapses to 0.75rem with no inset. */}
      <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-line bg-surface-3 px-4 pt-3 [padding-bottom:calc(0.75rem+env(safe-area-inset-bottom))]">
        <Button variant="secondary" onClick={reset}>
          {t("common.resetToDefaults")}
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={cancel}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" onClick={save}>
            {t("common.save")}
          </Button>
        </div>
      </footer>
    </Modal>
  );
}
