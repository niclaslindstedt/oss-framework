// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The bundled English catalog — also the source of the `Catalog` / message-key
// types every other language must satisfy. Grouped by surface; the runtime
// (`./index.ts`) flattens it to dotted keys (`menu.checklists`, …) that `t()`
// resolves. Mirrors the per-area layout a real app's locale tables use.

import type { Widen } from "@niclaslindstedt/oss-framework/i18n";

export const en = {
  common: {
    close: "Close",
    cancel: "Cancel",
    save: "Save",
    resetToDefaults: "Reset to defaults",
  },
  menu: {
    namespace: "Namespace",
    checklists: "Checklists",
    newChecklist: "New checklist",
    newFolder: "New folder",
    folderName: "Folder name",
    renameFolder: "Rename folder",
    deleteFolder: "Delete folder",
    folderActions: "Folder actions",
    newChecklistIn: "New checklist in {name}",
    checklistName: "Checklist name",
    renameChecklist: "Rename",
    deleteChecklist: "Delete",
    checklistActions: "Checklist actions",
    dragToMove: "Drag to move",
    moveToWorkspace: "Move to workspace",
    moveToNamespace: "Move to {name}",
    dropToArchive: "Drop here to archive",
    archive: "Archive",
    undo: "Undo",
    redo: "Redo",
    search: "Search",
    donate: "Donate",
    about: "About",
    whatsNew: "What’s new",
    source: "Source code",
    checkUpdates: "Check for updates",
    checkingUpdates: "Checking for updates…",
    upToDate: "You’re up to date",
    updateAvailable: "Update available",
    updatesUnavailable: "Updates unavailable",
    settings: "Settings",
  },
  changelog: {
    heading: "What’s new",
    empty: "No releases yet.",
    back: "Back",
  },
  archive: {
    title: "Archive",
    empty:
      "Nothing archived. Swipe a list or folder right — or drag it onto Archive — to shelve it here.",
    folders: "Archived folders",
    checklists: "Archived checklists",
    items: "Archived items",
    restoreFolder: "Restore folder",
    restoreChecklist: "Restore checklist",
    restoreItem: "Restore item",
    delete: "Delete",
    rowActions: "Archive actions",
  },
  search: {
    title: "Search",
    placeholder: "Search lists and items…",
    clear: "Clear search",
    prompt: "Search your lists and items.",
    hint: "Use * and ? for wildcards, or /regex/ for a pattern.",
    invalidRegex: "Invalid regular expression.",
    noResults: "No results for “{query}”.",
    matchesOne: "1 list",
    matchesOther: "{n} lists",
    inList: "in this list",
  },
  namespaces: {
    open: "Manage namespaces",
    heading: "Namespaces",
    blurb:
      "Each namespace is its own workspace with its own lists. Switch between them, or give one an icon and colour.",
    newAction: "New namespace",
    namePlaceholder: "Namespace name",
    nameLabel: "Namespace name",
    create: "Create",
    nameRequired: "A name is required",
    colorLabel: "Colour",
    glyphLabel: "Icon",
    glyphNone: "No icon",
    save: "Save",
    cancel: "Cancel",
    renameAction: "Rename",
    deleteAction: "Delete namespace",
    delete: "Delete",
    deleteConfirm:
      "Delete “{name}” and all of its lists? This can't be undone.",
    switchTo: "Switch to {name}",
    defaultBadge: "Default",
  },
  screen: {
    addItem: "Add an item…",
    addItemAria: "Add item",
    editItem: "Edit item",
    clear: "Clear",
    copyList: "Copy list",
    copied: "Copied",
    archive: "Archive",
    moreActions: "More actions",
    archiveFinished: "Archive finished items",
    deleteFinished: "Delete finished items",
  },
  sync: {
    // The header status glyph (`SyncStatus`).
    saving: "Saving…",
    syncedTo: "Synced to {name}",
    saveUnsaved: "Unsaved changes — tap for details",
    failed: "Sync failed — tap for details",
    throttled: "Rate limited — tap for details",
    reauthRequired: "Reconnect needed — tap to fix",
    syncConflict: "Sync conflict — tap to resolve",
    offline: "Offline — editing a local copy",
    // The command centre (`SyncDetailsModal`).
    cloudSync: "Sync",
    status: "Status",
    backend: "Backend",
    fileLocation: "File location",
    encryptionLabel: "Encryption",
    encryptionOn: "On",
    encryptionOff: "Off",
    reloadFromBackend: "Reload from the backend",
    saveNow: "Save now",
    tryAgain: "Try again",
    reconnect: "Reconnect {name}",
    openIn: "Open in {name}",
    checkConnection: "Check connection",
    viewSyncLog: "View sync log",
    hideSyncLog: "Hide sync log",
    syncingNow: "Saving your changes…",
    failedHeading: "Sync failed",
    failedDetailFallback:
      "The last save to {name} didn't go through. Try again — and if it keeps failing, check your connection.",
    throttledHeading: "Rate limited",
    throttledDetail:
      "{name} is asking the app to slow down. Saving will resume automatically in a moment.",
    reauthHeading: "Reconnect needed",
    reauthDetail:
      "Your session with {name} has expired. Reconnect to keep saving.",
    conflictHeading: "Sync conflict",
    conflictDetail:
      "Another device saved a newer version. Open the document to pick which copy to keep.",
    pendingHeading: "Waiting to sync",
    pendingDetail: "Your latest edits aren't saved to {name} yet.",
    offlineHeading: "Offline",
    offlineDetail:
      "Can't reach {name} right now, so you're working on the copy saved on this device. Any changes are kept locally and sync automatically when you're back online.",
    checkPinging: "Reaching {name}…",
    checkStillOffline:
      "Still can't reach {name}. Your edits are saved on this device and will sync automatically once you're back online.",
    checkAuthExpired:
      "Your session with {name} has expired — reconnect to continue.",
  },
  settings: {
    tabs: {
      general: "General",
      appearance: "Appearance",
      editor: "Editor",
      storage: "Storage",
      developer: "Developer",
      logs: "Logs",
    },
    general: {
      intro: "General preferences for this device.",
      languageTitle: "Language",
      chooseLanguage: "Choose language",
      languageHint: "Translate the UI between English and Swedish.",
      achievementsTitle: "Achievements",
      disableAchievements: "Disable achievements",
      disableAchievementsHint:
        "Stop tracking achievements and hide the trophy button. Achievements you've already earned are kept.",
      sidebarTitle: "Sidebar",
      openSidebarWith: "Open sidebar with",
      sidebarHint:
        "Choose how to open the sidebar on this device — tap the floating button, or swipe in from the edge of the screen. Settings lives in the sidebar's footer.",
      developerTitle: "Developer",
      developerMode: "Developer mode",
      developerModeHint:
        "Reveal the Developer tab with diagnostic tools. Stays on this device.",
      optionSwipe: "Right-swipe",
      optionButton: "Floating button",
    },
    editor: {
      intro: "How item text behaves as you type.",
      inputTitle: "Input",
      spellCheck: "Spell check",
      spellCheckHint: "Underline misspelled words while editing an item.",
      monospace: "Monospace items",
      monospaceHint: "Render item text in the monospace UI font.",
      listTitle: "New items",
      addItemPosition: "Add new items at",
      addItemPositionHint:
        "Where the add button drops a new item. Pressing Enter on an item always adds the next one right below it.",
      optionTop: "Start of list",
      optionBottom: "End of list",
    },
    storage: {
      documentTitle: "Document",
      docPlaceholder:
        "Type a document, then Save. Reload the page — it persists.",
      reload: "Reload",
      enciphering: "enciphering…",
      reading: "reading…",
      flakyBackend: "Simulate a flaky backend",
      flakyBackendHint:
        "Inject transient save failures so the framework's retry policy rides its backoff curve until the write lands.",
      viewSaveLog: "View save log",
      saveLogTitle: "Save log",
      saveLogEmpty: "This save logged nothing.",
      encryptionTitle: "Encryption at rest",
      encryptDocument: "Encrypt this document",
      encryptDocumentHint:
        "Wrap the backend with withEncryption — bytes on disk become an AES-GCM envelope keyed by your passphrase.",
      encryptedUnlocked:
        "Encrypted & unlocked — saves encipher, loads decrypt.",
      lock: "Lock (simulate reload)",
      passphrase: "Passphrase",
      unlock: "Unlock",
      encrypt: "Encrypt",
      bytesTitle: "Bytes on disk",
      bytesIntro:
        "What localStorage actually holds for this document — plaintext, or the JSON envelope when encrypted.",
      showStoredBytes: "Show stored bytes",
      refresh: "Refresh",
      cloudSyncTitle: "Where your data lives",
      cloudSyncHint:
        "Pick a backend for the document. The header's cloud glyph reflects the save state; tap it for the sync command centre. The cloud here is simulated — no data leaves your device.",
      backendThisDevice: "This device",
      backendCloud: "Simulated cloud",
      cloudProviderTitle: "Cloud drive",
      cloudProviderHint:
        'Which drive the simulated cloud syncs to. Open the menu and start typing — "one" jumps to OneDrive. Your pick shows up after "synced to …" on the header glyph and as the folder in the command centre.',
      encryptSync: "Encrypt at rest",
      encryptSyncHint:
        "Show the backend as encrypted in the command centre's details grid (On/Off).",
    },
    developer: {
      intro: "Diagnostic tools. These stay on this device.",
      loggingTitle: "Logging",
      captureLogs: "Capture logs",
      captureLogsHint:
        "Record diagnostic log lines so the Logs tab can show them.",
      writeTestLine: "Write a test log line",
      updatesTitle: "Software updates",
      simulateUpdate: "Simulate an available update",
      syncFaultsTitle: "Sync faults",
      syncFaultsIntro:
        "Inject a fault into the simulated cloud backend, then open the header's sync glyph to see how the command centre surfaces and recovers from it. Switch the backend to the simulated cloud (Storage tab) first.",
      faultOffline: "Go offline",
      faultAuth: "Expire the session",
      faultConflict: "Trigger a conflict",
      faultThrottle: "Rate limit",
      faultClear: "Clear fault",
      migrationsTitle: "Document migrations",
      migrationsIntro:
        "Your saved document carries a version; the framework's migrator runs older documents forward on load. Drop a legacy (pre-versioning) document on disk to watch it climb to the current version — the upgrade is logged on the Logs tab.",
      latestVersionLabel: "latest version",
      loadLegacy: "Load a legacy document",
      buildTitle: "Build",
      modeLabel: "mode",
      displayLabel: "display",
      installedPwa: "installed PWA (standalone)",
      browserTab: "browser tab",
    },
    logs: {
      intro:
        "The in-app log buffer, rendered live from the framework's logging module.",
      logsTitle: "Logs",
    },
  },
} as const;

// The catalog shape every language must satisfy. `Widen` relaxes each leaf
// from its English literal to plain `string` so a translation can differ.
export type Catalog = Widen<typeof en>;
