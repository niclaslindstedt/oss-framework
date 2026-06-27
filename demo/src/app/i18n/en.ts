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
    renameChecklist: "Rename checklist",
    deleteChecklist: "Delete checklist",
    checklistActions: "Checklist actions",
    archive: "Archive",
    undo: "Undo",
    redo: "Redo",
    search: "Search",
    donate: "Donate",
    about: "About",
    settings: "Settings",
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
    clear: "Clear",
    copyList: "Copy list",
    copied: "Copied",
    inSync: "In sync — tap or pull to refresh",
    syncing: "Syncing…",
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
