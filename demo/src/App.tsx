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
import {
  UpdateToast,
  usePwaUpdate,
  type PwaUpdateCheckResult,
} from "@niclaslindstedt/oss-framework/pwa";
import { SyncDetailsModal } from "@niclaslindstedt/oss-framework/sync";
import { ChangelogModal } from "@niclaslindstedt/oss-framework/changelog";
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

import { ArchiveScreen } from "./app/ArchiveScreen.tsx";
import { ChecklistScreen } from "./app/ChecklistScreen.tsx";
import { RELEASES, FEATURE_DOCS } from "./app/changelog.ts";
import { SearchOverlay } from "./app/SearchOverlay.tsx";
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
import { cacheIdForBase } from "./app/pwa.ts";

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
  const [searchOpen, setSearchOpen] = useState(false);
  // The top-level view the main area shows: the active checklist, or the Archive
  // page (reached from the side menu's Archive button). Selecting or creating a
  // list from the menu drops back to the checklist view.
  const [view, setView] = useState<"checklist" | "archive">("checklist");
  // The "What's new" dialog, opened from the side menu's About dropdown.
  const [changelogOpen, setChangelogOpen] = useState(false);
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
  // The real PWA update lifecycle, driven by the demo's own service worker
  // (built by `demo/pwa-plugin.ts`). In a deployed install this raises the
  // prompt when a freshly-deployed build reaches the `waiting` state; in dev
  // (`enabled: false`) it stays idle and registers nothing. The cache id is
  // derived from the deploy-slot base so each of `/`, `/preview/`, `/branch/`
  // owns a distinct precache on the shared origin (see `./app/pwa.ts`).
  const pwa = usePwaUpdate({
    base: import.meta.env.BASE_URL,
    cacheId: cacheIdForBase(import.meta.env.BASE_URL),
    enabled: !import.meta.env.DEV,
  });

  // The Settings → Developer tab can also STAGE a fake waiting build, so the
  // prompt is demoable on demand — including in local dev, where no service
  // worker registers. We split "a build is waiting" (`simPending`) from "the
  // prompt is visible" (`simReady`) so dismissing leaves the build pending and
  // the footer's "Check for updates" row re-surfaces it, exactly as the real
  // hook behaves. Both OR into the real hook's state below.
  const [simReady, setSimReady] = useState(false);
  const [simPending, setSimPending] = useState(false);

  const needRefresh = pwa.needRefresh || simReady;
  const updateAvailable = pwa.needRefresh || simPending;

  // Probe for a newer build. A staged demo build re-raises the prompt without
  // touching the network; otherwise defer to the real hook's check.
  const checkForUpdate = async (): Promise<PwaUpdateCheckResult> => {
    if (simPending) {
      setSimReady(true);
      return "update-found";
    }
    return pwa.checkForUpdate();
  };

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
  // drive (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z / Ctrl+Y). The hook already stands down
  // on its own while a modal (Settings, "What's new") owns the keyboard, so the
  // only gate left for the app is the phone navigation drawer — a non-modal
  // `<nav>` the hook can't detect — which owns the keyboard while open over the
  // screen but never when the sidebar is docked (pinned) on a wide screen.
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
          namespaces={ns.list}
          onSwitchNamespace={ns.switchTo}
          onOpenNamespaces={() => setNamespacesOpen(true)}
          onOpenSettings={() => {
            setDrawerOpen(false);
            setSettingsOpen(true);
          }}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenChangelog={() => {
            setDrawerOpen(false);
            setChangelogOpen(true);
          }}
          onNavigate={() => {
            // Selecting or creating a list always lands on the checklist view —
            // a tap in the menu navigates away from the Archive page.
            setView("checklist");
            if (!pinned) setDrawerOpen(false);
          }}
          view={view}
          onShowArchive={() => {
            setView("archive");
            if (!pinned) setDrawerOpen(false);
          }}
          checkingUpdate={pwa.checking}
          updateAvailable={updateAvailable}
          onCheckUpdate={checkForUpdate}
        />
      </Sidebar>

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {view === "archive" ? (
          <ArchiveScreen store={store} />
        ) : (
          <ChecklistScreen
            store={store}
            sync={sync}
            onOpenSyncDetails={() => setSyncDetailsOpen(true)}
            addItemPosition={settings.addItemPosition}
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
        )}
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
          setSimPending(true);
          setSimReady(true);
        }}
        // Drop a legacy document on disk and let the store's migrator upgrade it
        // live — the upgrade lands in the Logs tab as "migrated v0 → v2".
        onLoadLegacy={() => store.simulateLegacyDoc()}
      />

      {/* The framework's PWA "a new version is ready" prompt, fed from the real
          `usePwaUpdate()` state above. A deployed install drives it from its
          service worker reaching `waiting`; a staged demo build (Developer tab)
          drives it through `simReady`. */}
      <UpdateToast
        needRefresh={needRefresh}
        incomingVersion={
          pwa.incomingVersion ?? (simReady ? "demo build" : null)
        }
        onReload={() => {
          // A real waiting build reloads the page onto itself; clear any staged
          // demo build alongside it.
          if (pwa.needRefresh) pwa.reload();
          setSimReady(false);
          setSimPending(false);
        }}
        // Dismissing only hides the prompt — a real build stays waiting and a
        // staged one stays pending, so the footer's "Check for updates" row
        // keeps reading "Update available" and can re-surface it.
        onDismiss={() => {
          if (pwa.needRefresh) pwa.dismiss();
          setSimReady(false);
        }}
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

      {/* Full-text search over the document — the framework `SearchModal` +
          matcher, with the corpus (grouped per list) and the result rows owned
          by the app (`SearchOverlay` / `search.ts`). Opened from the side menu's
          search button; picking a result selects that list. */}
      <SearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        store={store}
        onNavigate={() => {
          if (!pinned) setDrawerOpen(false);
        }}
      />

      {/* The "What's new" dialog — opened from the side menu's About dropdown.
          The framework `ChangelogModal` owns the overlay, the markdown rendering,
          and the `[Learn more]` drill-down; the app inlines the CHANGELOG and the
          feature docs at build time (`./app/changelog.ts`) and translates the
          chrome through its own i18n. */}
      <ChangelogModal
        open={changelogOpen}
        onClose={() => setChangelogOpen(false)}
        releases={RELEASES}
        featureDocs={FEATURE_DOCS}
        labels={{
          heading: t("changelog.heading"),
          empty: t("changelog.empty"),
          close: t("common.close"),
          back: t("changelog.back"),
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
