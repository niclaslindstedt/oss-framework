// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useState } from "react";

import {
  useApplyTheme,
  type ThemeAppearance,
} from "@niclaslindstedt/oss-framework/theme";
import {
  Sidebar,
  type MenuButtonPosition,
} from "@niclaslindstedt/oss-framework/sidebar";

import { ChecklistScreen } from "./app/ChecklistScreen.tsx";
import { SettingsModal } from "./app/SettingsModal.tsx";
import { SideMenuContent } from "./app/SideMenuContent.tsx";
import { APP_LOOK } from "./app/look.ts";
import { seedLogsOnce } from "./app/log.ts";
import { useAppSettings } from "./app/useAppSettings.ts";
import { useChecklistStore } from "./app/useChecklistStore.ts";
import { useMediaQuery } from "./app/useMediaQuery.ts";

// The demo *is* a fully-fledged app: a local-first nested-checklist PWA built
// entirely from the framework's shared surface, in the apps' own black/green
// look. The framework `Sidebar` frames the navigation (docked on wide screens,
// a draggable drawer on phones); the app owns the document store, the list
// screen, the side-menu content, and its tabbed Settings dialog. New apps can
// lift this folder as a starting point — it is the template the framework is
// meant to seed.
export function App() {
  const [appearance, setAppearance] = useState<ThemeAppearance>(APP_LOOK);
  useApplyTheme(appearance);

  const store = useChecklistStore();
  const { settings, setSettings } = useAppSettings();

  // Wide screens (≥ the smallest iPad) dock the sidebar permanently; phones
  // collapse it to a draggable drawer. The app derives this — the framework
  // shell is told the answer.
  const pinned = useMediaQuery("(min-width: 768px)");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [position, setPosition] = useState<MenuButtonPosition>({
    side: "left",
    y: 0.5,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    seedLogsOnce();
  }, []);

  return (
    <div className="flex h-[100svh] overflow-hidden bg-page-bg text-fg">
      <Sidebar
        pinned={pinned}
        open={drawerOpen}
        onToggle={() => setDrawerOpen((v) => !v)}
        onClose={() => setDrawerOpen(false)}
        position={position}
        onPositionChange={setPosition}
        // The framework shell owns only swipe-to-close; edge-swipe-open is app
        // glue it doesn't ship yet, so the floating button is always offered on
        // phones whatever the (persisted) "open the menu with" preference says.
        showButton={!pinned}
        swipeToClose
        panelScroll={false}
        labels={{
          nav: "Checklists",
          open: "Open menu",
          close: "Close menu",
        }}
      >
        <SideMenuContent
          store={store}
          onOpenSettings={() => {
            setDrawerOpen(false);
            setSettingsOpen(true);
          }}
          onNavigate={() => {
            if (!pinned) setDrawerOpen(false);
          }}
        />
      </Sidebar>

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <ChecklistScreen store={store} />
      </main>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        appearance={appearance}
        setAppearance={setAppearance}
        settings={settings}
        commitSettings={setSettings}
      />
    </div>
  );
}
