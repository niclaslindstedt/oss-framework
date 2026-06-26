// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useState } from "react";

import {
  useApplyTheme,
  type ThemeAppearance,
} from "@niclaslindstedt/oss-framework/theme";
import {
  Sidebar,
  useEdgeSwipeOpen,
  type MenuButtonPosition,
} from "@niclaslindstedt/oss-framework/sidebar";
import {
  DEFAULT_GLYPH,
  glyphDataUri,
} from "@niclaslindstedt/oss-framework/glyphs";

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

  // "Open the menu with" (Settings → General): on phones, the user picks
  // between the floating button and an inward edge swipe. In swipe mode the
  // button is hidden and `useEdgeSwipeOpen` opens the drawer from whichever
  // edge it rests on — the same gesture the source apps offer in their PWA.
  const swipeToOpen = !pinned && settings.menuMode === "swipe";
  useEdgeSwipeOpen({
    side: position.side,
    enabled: swipeToOpen && !drawerOpen,
    onOpen: () => setDrawerOpen(true),
  });

  useEffect(() => {
    seedLogsOnce();
  }, []);

  // Re-badge the browser tab to the active list's glyph + accent — the same
  // `/glyphs` catalogue the side menu and the appearance picker draw from,
  // serialised to a favicon data URI. Picking a new icon or colour updates the
  // tab live. The badge sits on the app's surface colour so it reads on a light
  // tab bar.
  const active = store.activeList;
  useEffect(() => {
    if (!active) return;
    const href = glyphDataUri(
      active.glyph ?? DEFAULT_GLYPH,
      active.color ?? "#86efac",
      {
        background: "#0b0d10",
      },
    );
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = href;
  }, [active]);

  return (
    <div className="flex h-[100svh] overflow-hidden bg-page-bg text-fg">
      <Sidebar
        pinned={pinned}
        open={drawerOpen}
        onToggle={() => setDrawerOpen((v) => !v)}
        onClose={() => setDrawerOpen(false)}
        position={position}
        onPositionChange={setPosition}
        // On phones the button shows only in "Floating button" mode; in
        // "Right-swipe" mode it's hidden and the edge-swipe gesture above opens
        // the drawer instead. Wide screens dock the menu and never show either.
        showButton={!pinned && !swipeToOpen}
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
