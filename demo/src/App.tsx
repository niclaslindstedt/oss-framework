// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useState } from "react";

import {
  useApplyTheme,
  type ThemeAppearance,
} from "@niclaslindstedt/oss-framework/theme";
import {
  Sidebar,
  useEdgeSwipeOpen,
  usePersistentMenuPosition,
  useSidebarInset,
} from "@niclaslindstedt/oss-framework/sidebar";
import { UpdateToast } from "@niclaslindstedt/oss-framework/pwa";
import { SyncDetailsModal } from "@niclaslindstedt/oss-framework/sync";
import { LogViewer } from "@niclaslindstedt/oss-framework/logging";
import {
  useMediaQuery,
  useUndoRedoShortcuts,
} from "@niclaslindstedt/oss-framework/hooks";
import {
  DEFAULT_GLYPH,
  glyphDataUri,
} from "@niclaslindstedt/oss-framework/glyphs";
import {
  NamespacesModal,
  applyFaviconHref,
  namespaceFaviconHref,
} from "@niclaslindstedt/oss-framework/namespaces";
import {
  AchievementUnlockModal,
  AchievementsModal,
  TrophyButton,
  unlock,
  useAchievementWatcher,
} from "@niclaslindstedt/oss-framework/achievements";

import { ChecklistScreen } from "./app/ChecklistScreen.tsx";
import { SettingsModal } from "./app/SettingsModal.tsx";
import { SideMenuContent } from "./app/SideMenuContent.tsx";
import { CATALOG } from "./app/achievements.ts";
import { useT } from "./app/i18n/index.ts";
import { APP_LOOK } from "./app/look.ts";
import { logStore, seedLogsOnce } from "./app/log.ts";
import { useAchievements } from "./app/useAchievements.ts";
import { useAppSettings } from "./app/useAppSettings.ts";
import { useChecklistStore } from "./app/useChecklistStore.ts";
import { useMockSync } from "./app/useMockSync.ts";
import { useNamespaces } from "./app/useNamespaces.ts";

// The demo *is* a fully-fledged app: a local-first nested-checklist PWA built
// entirely from the framework's shared surface, in the apps' own black/green
// look. The framework `Sidebar` frames the navigation (docked on wide screens,
// a draggable drawer on phones); the app owns the document store, the list
// screen, the side-menu content, and its tabbed Settings dialog. New apps can
// lift this folder as a starting point — it is the template the framework is
// meant to seed.
export function App() {
  const t = useT();
  const [appearance, setAppearance] = useState<ThemeAppearance>(APP_LOOK);
  useApplyTheme(appearance);

  // Namespaces (workspaces). The registry + active pointer live in the app
  // (`useNamespaces`, the framework's "store stays in the app" seam); the
  // document store keys off the active slug, so switching a namespace swaps the
  // whole checklist document and its undo history.
  const ns = useNamespaces();
  const store = useChecklistStore(ns.activeSlug);
  const [namespacesOpen, setNamespacesOpen] = useState(false);
  const { settings, setSettings } = useAppSettings();

  // The (simulated) sync engine — the app-owned state machine the framework's
  // `SyncStatus` glyph + `SyncDetailsModal` command centre paint over. It
  // watches the document store's edit counter to know when there are unsaved
  // changes and fakes a cloud round trip; the Developer tab injects the faults
  // that exercise the modal's recovery affordances.
  const sync = useMockSync(store, ns.activeSlug);
  const [syncDetailsOpen, setSyncDetailsOpen] = useState(false);

  // Wide screens (≥ the smallest iPad) dock the sidebar permanently; phones
  // collapse it to a draggable drawer. The app derives this — the framework
  // shell is told the answer.
  const pinned = useMediaQuery("(min-width: 768px)");
  const [drawerOpen, setDrawerOpen] = useState(false);
  // The sidebar button's resting spot is remembered across reloads by the
  // framework's `usePersistentMenuPosition` — a drop-in for `useState` backed by
  // localStorage, so a placement the user drags it to survives a refresh.
  const [position, setPosition] = usePersistentMenuPosition(
    "oss-demo:checklist:menu-position",
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Achievements (Settings → General toggles the feature off). The store is the
  // app's — the framework owns the engine, the bus, and the trophy UI. Earning
  // a trophy lights the header button; clicking it opens the unlock modal when
  // there's something new, or the full tour when it's quiet.
  const achievementsEnabled = !settings.disableAchievements;
  const ach = useAchievements(store.data, achievementsEnabled);
  const [tourOpen, setTourOpen] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);

  // Undo lives outside the document state, so its trophy fires through the
  // manual bus rather than a derived predicate. Wrap the store's undo so both
  // the side-menu button and the keyboard chord award it.
  const undoWithTrophy = () => {
    store.undo();
    unlock("timeTraveler");
  };

  // Run the framework watcher: derive unlocks from each document transition and
  // drain the manual bus. The demo loads synchronously, so it's `loaded` from
  // the first render (the watcher still baselines that render, so the seed never
  // backfills — the retroactive award in `useAchievements` handles the seed).
  useAchievementWatcher({
    catalog: CATALOG,
    state: store.data,
    unlocked: ach.unlocked,
    loaded: true,
    enabled: achievementsEnabled,
    record: ach.record,
  });
  // A simulated "a new build is ready" flag. A real installed PWA would drive
  // this from `usePwaUpdate()` (its service worker reaching the `waiting`
  // state); this static demo has no service worker, so the Developer tab lets
  // you trigger the prompt to see the framework `UpdateToast` in its real spot.
  const [updateReady, setUpdateReady] = useState(false);

  // "Open sidebar with" (Settings → General): on phones, the user picks between
  // the floating button and an inward edge swipe. In swipe mode the button is
  // hidden and `useEdgeSwipeOpen` opens the drawer from whichever edge it rests
  // on — the same gesture the source apps offer in their PWA. Settings itself is
  // reached from the sidebar's footer row, so there is a single floating button.
  const swipeToOpen = !pinned && settings.menuMode === "swipe";
  useEdgeSwipeOpen({
    side: position.side,
    enabled: swipeToOpen && !drawerOpen,
    onOpen: () => setDrawerOpen(true),
  });

  // Keyboard undo/redo over the same document history the side-menu buttons
  // drive (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z / Ctrl+Y). Silenced while a phone
  // drawer is open over the screen — the drawer owns the keyboard then — but
  // always live when the sidebar is docked (pinned) on a wide screen.
  useUndoRedoShortcuts({
    canUndo: store.canUndo,
    canRedo: store.canRedo,
    onUndo: undoWithTrophy,
    onRedo: store.redo,
    enabled: pinned || !drawerOpen,
  });

  // Publish the docked sidebar's footprint as CSS variables so a
  // viewport-`fixed` overlay mounted outside this flex layout — the
  // `UpdateToast` below — centres over the content band rather than the whole
  // window when the menu is pinned on a wide screen.
  useSidebarInset(pinned, position.side);

  useEffect(() => {
    seedLogsOnce();
  }, []);

  // Re-badge the browser tab. The active *namespace*'s glyph wins when it has
  // one (the framework's `namespaceFaviconHref` resolves it), so a glance at
  // the tab tells you which workspace you're in; otherwise it falls back to the
  // active list's glyph + accent — the same `/glyphs` catalogue the side menu
  // and the appearance picker draw from. The badge sits on the app's surface
  // colour so it reads on a light tab bar.
  const active = store.activeList;
  const activeNamespace = ns.activeNamespace;
  useEffect(() => {
    const listHref = glyphDataUri(
      active?.glyph ?? DEFAULT_GLYPH,
      active?.color ?? "#86efac",
      { background: "#0b0d10" },
    );
    applyFaviconHref(
      namespaceFaviconHref(activeNamespace, listHref, {
        defaultColor: "#86efac",
        badge: { background: "#0b0d10" },
      }),
    );
  }, [active, activeNamespace]);

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
          open: "Open sidebar",
          close: "Close sidebar",
        }}
      >
        <SideMenuContent
          store={{ ...store, undo: undoWithTrophy }}
          activeNamespace={ns.activeNamespace}
          onOpenNamespaces={() => setNamespacesOpen(true)}
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
        <ChecklistScreen
          store={store}
          sync={sync}
          onOpenSyncDetails={() => setSyncDetailsOpen(true)}
          trophy={
            achievementsEnabled ? (
              <TrophyButton
                unseenCount={ach.unseen.length}
                onClick={() =>
                  ach.unseen.length > 0
                    ? setUnlockOpen(true)
                    : setTourOpen(true)
                }
                className="relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-line text-muted hover:bg-surface-2 hover:text-fg"
              />
            ) : null
          }
        />
      </main>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        appearance={appearance}
        setAppearance={setAppearance}
        settings={settings}
        commitSettings={setSettings}
        sync={sync}
        // Close Settings and surface the update prompt so it isn't hidden
        // behind the dialog — the prompt is a page-level overlay.
        onSimulateUpdate={() => {
          setSettingsOpen(false);
          setUpdateReady(true);
        }}
        // Drop a legacy document on disk and let the store's migrator upgrade it
        // live — the upgrade lands in the Logs tab as "migrated v0 → v2".
        onLoadLegacy={() => store.simulateLegacyDoc()}
      />

      {/* The framework's PWA "a new version is ready" prompt. An installed app
          would feed this from `usePwaUpdate()`; here it's driven by the
          simulated flag the Developer tab toggles. Applying it just clears the
          prompt (a real app reloads onto the new build). */}
      <UpdateToast
        needRefresh={updateReady}
        incomingVersion="2.0.0-demo"
        onReload={() => setUpdateReady(false)}
        onDismiss={() => setUpdateReady(false)}
      />

      {/* The sync command centre — opened by the list header's `SyncStatus`
          glyph. Purely presentational: the app's simulated engine (`useMockSync`)
          owns the state and the actions; the framework lays them out. The
          developer log slot is gated on dev mode and fed the same in-app buffer
          the Logs tab shows, scoped to the `sync` activity the engine emits. */}
      <SyncDetailsModal
        open={syncDetailsOpen}
        onClose={() => setSyncDetailsOpen(false)}
        providerName={sync.providerName}
        backendKind={sync.backendKind}
        location={sync.location}
        encrypted={sync.encrypted}
        status={sync.status}
        dirty={sync.dirty}
        offline={sync.offline}
        onSaveNow={sync.saveNow}
        onReload={sync.reload}
        onReconnect={sync.reconnect}
        onCheckConnection={sync.checkConnection}
        logPanel={settings.devMode ? <LogViewer store={logStore} /> : undefined}
        labels={{
          cloudSync: t("sync.cloudSync"),
          close: t("common.close"),
          status: t("sync.status"),
          backend: t("sync.backend"),
          fileLocation: t("sync.fileLocation"),
          encryptionLabel: t("sync.encryptionLabel"),
          encryptionOn: t("sync.encryptionOn"),
          encryptionOff: t("sync.encryptionOff"),
          reloadFromBackend: t("sync.reloadFromBackend"),
          saveNow: t("sync.saveNow"),
          tryAgain: t("sync.tryAgain"),
          reconnect: (name) => t("sync.reconnect", { name }),
          openIn: (name) => t("sync.openIn", { name }),
          checkConnection: t("sync.checkConnection"),
          viewSyncLog: t("sync.viewSyncLog"),
          hideSyncLog: t("sync.hideSyncLog"),
          syncingNow: t("sync.syncingNow"),
          failedHeading: t("sync.failedHeading"),
          throttledHeading: t("sync.throttledHeading"),
          throttledDetail: (name) => t("sync.throttledDetail", { name }),
          reauthHeading: t("sync.reauthHeading"),
          reauthDetail: (name) => t("sync.reauthDetail", { name }),
          conflictHeading: t("sync.conflictHeading"),
          conflictDetail: t("sync.conflictDetail"),
          pendingHeading: t("sync.pendingHeading"),
          pendingDetail: (name) => t("sync.pendingDetail", { name }),
          offlineHeading: t("sync.offlineHeading"),
          offlineDetail: (name) => t("sync.offlineDetail", { name }),
          syncedTo: (name) => t("sync.syncedTo", { name }),
          checkPinging: (name) => t("sync.checkPinging", { name }),
          checkStillOffline: (name) => t("sync.checkStillOffline", { name }),
          checkAuthExpired: (name) => t("sync.checkAuthExpired", { name }),
          failedDetailFallback: (name) =>
            t("sync.failedDetailFallback", { name }),
        }}
      />

      {/* The namespaces manager — create / switch / rename / restyle / delete
          workspaces. Presentational: the app owns the registry (`useNamespaces`)
          and passes the list + operations in; the framework owns the dialog and
          the pure list logic behind these handlers. Labels come from the demo's
          own i18n, so the dialog speaks whatever language the app is in. */}
      <NamespacesModal
        open={namespacesOpen}
        onClose={() => setNamespacesOpen(false)}
        namespaces={ns.list}
        activeNamespace={ns.activeSlug}
        onSwitch={ns.switchTo}
        onCreate={ns.create}
        onRename={ns.rename}
        onSetAppearance={ns.setAppearance}
        onRemove={ns.remove}
        labels={{
          heading: t("namespaces.heading"),
          blurb: t("namespaces.blurb"),
          newAction: t("namespaces.newAction"),
          namePlaceholder: t("namespaces.namePlaceholder"),
          nameLabel: t("namespaces.nameLabel"),
          create: t("namespaces.create"),
          nameRequired: t("namespaces.nameRequired"),
          colorLabel: t("namespaces.colorLabel"),
          glyphLabel: t("namespaces.glyphLabel"),
          glyphNone: t("namespaces.glyphNone"),
          save: t("namespaces.save"),
          cancel: t("namespaces.cancel"),
          renameAction: t("namespaces.renameAction"),
          deleteAction: t("namespaces.deleteAction"),
          delete: t("namespaces.delete"),
          deleteConfirm: (name) => t("namespaces.deleteConfirm", { name }),
          switchTo: (name) => t("namespaces.switchTo", { name }),
          defaultBadge: t("namespaces.defaultBadge"),
          close: t("common.close"),
        }}
      />

      {/* The achievements tour — the full four-tier catalog, every feature a
          trophy. Reads the earned map from the app's own store. */}
      <AchievementsModal
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        achievements={CATALOG}
        unlocked={ach.unlocked}
      />

      {/* The unlock celebration — just the freshly-earned trophies. Closing it
          clears the unseen queue, returning the trophy button to its quiet
          state. */}
      <AchievementUnlockModal
        open={unlockOpen}
        onClose={() => {
          setUnlockOpen(false);
          ach.clearUnseen();
        }}
        achievements={CATALOG}
        unseenIds={ach.unseen}
      />
    </div>
  );
}
