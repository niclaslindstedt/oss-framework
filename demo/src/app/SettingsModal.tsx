// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

import {
  Button,
  FloatingPanel,
  Modal,
  CloseIcon,
  CogIcon,
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
import type { MockSync } from "./useMockSync.ts";
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
  "general" | "appearance" | "editor" | "storage" | "developer" | "logs";

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
  // The simulated sync engine — its backend picker lives in the Storage tab and
  // its fault injectors in the Developer tab. These controls apply live (like
  // the appearance preview), not staged in the draft.
  sync: MockSync;
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
  sync,
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

  // The Developer tab only exists while developer mode is on; the Logs tab only
  // while log capture is on — there's nothing to show when the app isn't
  // catching logs. Mirror the real app. If the active tab vanishes, fall back
  // to General.
  const visible = TABS.filter(
    (tabItem) =>
      (tabItem.id !== "developer" || draft.devMode) &&
      (tabItem.id !== "logs" || draft.captureLogs),
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
      footer={
        // Reset (left) | Cancel + Save (right). The Modal owns the bottom
        // safe-area inset beneath this bar, so it keeps plain footer padding.
        <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-line bg-surface-3 px-4 py-3">
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
      }
    >
      {/* Header. On mobile the burger + active-tab label form one toggle that
          opens the section menu; on desktop the left rail owns selection and the
          header shows the static "Settings" title (the burger is hidden at `sm:`
          and up). The h2 stays mounted (sr-only on mobile) so
          `aria-labelledby` always resolves. */}
      <header className="relative flex shrink-0 items-center justify-between gap-2 border-b border-line bg-surface-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="relative sm:hidden">
            <button
              ref={menuRef}
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={t("settings.chooseSection")}
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
          </div>
          <h2
            id="settings-title"
            className="sr-only text-sm font-bold tracking-wide text-fg-bright sm:not-sr-only"
          >
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex shrink-0 text-accent">
                <CogIcon className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0">{t("settings.title")}</span>
            </span>
          </h2>
        </div>
        <button
          type="button"
          onClick={cancel}
          aria-label={t("common.close")}
          className="-mr-1 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-fg"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </header>

      {/* Body: desktop tab rail (hidden on mobile, where the burger takes over)
          beside the scrolling tab panel. */}
      <div className="flex flex-1 overflow-hidden">
        <TabSidebar
          tabs={visible}
          activeTab={activeTab}
          onSelect={setTab}
          label={t("settings.sections")}
          t={t}
        />

        <div
          role="tabpanel"
          id={`settings-tabpanel-${activeTab}`}
          aria-labelledby={`settings-tab-${activeTab}`}
          tabIndex={0}
          className="flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4"
        >
          {activeTab === "general" && (
            <GeneralTab settings={draft} update={update} />
          )}
          {activeTab === "appearance" && (
            <AppearancePicker
              appearance={appearance}
              onChange={setAppearance}
            />
          )}
          {activeTab === "editor" && (
            <EditorTab settings={draft} update={update} />
          )}
          {activeTab === "storage" && <StorageTab sync={sync} />}
          {activeTab === "developer" && (
            <DeveloperTab
              settings={draft}
              update={update}
              sync={sync}
              onSimulateUpdate={onSimulateUpdate}
              onLoadLegacy={onLoadLegacy}
            />
          )}
          {activeTab === "logs" && <LogsTab />}
        </div>
      </div>
    </Modal>
  );
}

// Desktop-only vertical tab rail (hidden below `sm`, where the header burger
// takes over). A WAI-ARIA tablist with roving tabindex and arrow-key
// navigation; activation follows focus to match the mouse / touch behaviour.
function TabSidebar({
  tabs,
  activeTab,
  onSelect,
  label,
  t,
}: {
  tabs: TabDef[];
  activeTab: TabId;
  onSelect: (id: TabId) => void;
  label: string;
  t: ReturnType<typeof useT>;
}) {
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  function handleKeyDown(
    e: ReactKeyboardEvent<HTMLButtonElement>,
    idx: number,
  ) {
    if (
      e.key !== "ArrowUp" &&
      e.key !== "ArrowDown" &&
      e.key !== "Home" &&
      e.key !== "End"
    )
      return;
    e.preventDefault();
    let next = idx;
    if (e.key === "ArrowUp") next = idx - 1;
    else if (e.key === "ArrowDown") next = idx + 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    const wrapped = (next + tabs.length) % tabs.length;
    const nextDef = tabs[wrapped];
    if (!nextDef) return;
    onSelect(nextDef.id);
    buttonRefs.current[nextDef.id]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-orientation="vertical"
      aria-label={label}
      className="hidden w-44 shrink-0 flex-col gap-0.5 overflow-y-auto overscroll-contain border-r border-line bg-surface-3 p-2 sm:flex"
    >
      {tabs.map((tabItem, idx) => {
        const Icon = tabItem.icon;
        const active = tabItem.id === activeTab;
        return (
          <button
            key={tabItem.id}
            ref={(el) => {
              buttonRefs.current[tabItem.id] = el;
            }}
            type="button"
            role="tab"
            id={`settings-tab-${tabItem.id}`}
            aria-controls={`settings-tabpanel-${tabItem.id}`}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onSelect(tabItem.id)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={`flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${
              active
                ? "bg-accent/15 font-bold text-accent"
                : "text-fg hover:bg-surface-2"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{t(tabItem.labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
}
