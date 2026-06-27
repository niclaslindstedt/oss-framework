// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The Swedish catalog — code-split, loaded on demand by the runtime when the
// user switches to Swedish. Typed as `Catalog` so a missing or renamed key is
// a compile error rather than a silent fall-through to English.

import type { Catalog } from "./en.ts";

export const sv: Catalog = {
  common: {
    close: "Stäng",
    cancel: "Avbryt",
    save: "Spara",
    resetToDefaults: "Återställ standard",
  },
  menu: {
    namespace: "Namnrymd",
    checklists: "Checklistor",
    newChecklist: "Ny checklista",
    newFolder: "Ny mapp",
    folderName: "Mappnamn",
    renameFolder: "Byt namn på mapp",
    folderActions: "Mappåtgärder",
    newChecklistIn: "Ny checklista i {name}",
    archive: "Arkiv",
    undo: "Ångra",
    redo: "Gör om",
    search: "Sök",
    donate: "Donera",
    about: "Om",
    settings: "Inställningar",
  },
  namespaces: {
    open: "Hantera namnrymder",
    heading: "Namnrymder",
    blurb:
      "Varje namnrymd är en egen arbetsyta med egna listor. Växla mellan dem, eller ge en av dem en ikon och färg.",
    newAction: "Ny namnrymd",
    namePlaceholder: "Namnrymdens namn",
    nameLabel: "Namnrymdens namn",
    create: "Skapa",
    nameRequired: "Ett namn krävs",
    colorLabel: "Färg",
    glyphLabel: "Ikon",
    glyphNone: "Ingen ikon",
    save: "Spara",
    cancel: "Avbryt",
    renameAction: "Byt namn",
    deleteAction: "Radera namnrymd",
    delete: "Radera",
    deleteConfirm:
      "Radera ”{name}” och alla dess listor? Detta kan inte ångras.",
    switchTo: "Växla till {name}",
    defaultBadge: "Standard",
  },
  screen: {
    addItem: "Lägg till en rad…",
    addItemAria: "Lägg till rad",
    clear: "Rensa",
    copyList: "Kopiera lista",
    copied: "Kopierad",
    inSync: "Synkroniserad — tryck eller dra för att uppdatera",
    syncing: "Synkroniserar…",
  },
  settings: {
    tabs: {
      general: "Allmänt",
      appearance: "Utseende",
      editor: "Redigerare",
      storage: "Lagring",
      developer: "Utvecklare",
      logs: "Loggar",
    },
    general: {
      intro: "Allmänna inställningar för den här enheten.",
      languageTitle: "Språk",
      chooseLanguage: "Välj språk",
      languageHint: "Översätt gränssnittet mellan engelska och svenska.",
      achievementsTitle: "Utmärkelser",
      disableAchievements: "Inaktivera utmärkelser",
      disableAchievementsHint:
        "Sluta spåra utmärkelser och dölj pokalknappen. Utmärkelser du redan har tjänat behålls.",
      sidebarTitle: "Sidofält",
      openSidebarWith: "Öppna sidofältet med",
      sidebarHint:
        "Välj hur sidofältet öppnas på den här enheten — tryck på den flytande knappen, eller svep in från skärmkanten. Inställningar nås från sidofältets sidfot.",
      developerTitle: "Utvecklare",
      developerMode: "Utvecklarläge",
      developerModeHint:
        "Visa fliken Utvecklare med diagnostikverktyg. Stannar på den här enheten.",
      optionSwipe: "Svep höger",
      optionButton: "Flytande knapp",
    },
    editor: {
      intro: "Hur radtext beter sig medan du skriver.",
      inputTitle: "Inmatning",
      spellCheck: "Stavningskontroll",
      spellCheckHint: "Stryk under felstavade ord medan en rad redigeras.",
      monospace: "Radtext med fast breddsteg",
      monospaceHint: "Visa radtext i gränssnittets monospace-typsnitt.",
    },
    storage: {
      documentTitle: "Dokument",
      docPlaceholder:
        "Skriv ett dokument och tryck Spara. Ladda om sidan — det finns kvar.",
      reload: "Ladda om",
      enciphering: "krypterar…",
      reading: "läser…",
      flakyBackend: "Simulera en ostadig backend",
      flakyBackendHint:
        "Injicera tillfälliga sparfel så att ramverkets omförsökspolicy rider sin backoff-kurva tills skrivningen går igenom.",
      encryptionTitle: "Kryptering i vila",
      encryptDocument: "Kryptera det här dokumentet",
      encryptDocumentHint:
        "Linda lagringen med withEncryption — byten på disk blir ett AES-GCM-kuvert som nycklas av din lösenfras.",
      encryptedUnlocked:
        "Krypterad & upplåst — sparningar krypterar, laddningar dekrypterar.",
      lock: "Lås (simulera omladdning)",
      passphrase: "Lösenfras",
      unlock: "Lås upp",
      encrypt: "Kryptera",
      bytesTitle: "Byten på disk",
      bytesIntro:
        "Vad localStorage faktiskt innehåller för det här dokumentet — klartext, eller JSON-kuvertet när det är krypterat.",
      showStoredBytes: "Visa lagrade byten",
      refresh: "Uppdatera",
    },
    developer: {
      intro: "Diagnostikverktyg. De stannar på den här enheten.",
      loggingTitle: "Loggning",
      captureLogs: "Fånga loggar",
      captureLogsHint:
        "Spela in diagnostiska loggrader så att fliken Loggar kan visa dem.",
      writeTestLine: "Skriv en testloggrad",
      updatesTitle: "Programuppdateringar",
      simulateUpdate: "Simulera en tillgänglig uppdatering",
      migrationsTitle: "Dokumentmigreringar",
      migrationsIntro:
        "Ditt sparade dokument bär en version; ramverkets migrerare kör äldre dokument framåt vid inläsning. Lägg ett äldre dokument (utan version) på disk för att se det klättra till den aktuella versionen — uppgraderingen loggas på fliken Loggar.",
      latestVersionLabel: "senaste version",
      loadLegacy: "Ladda ett äldre dokument",
      buildTitle: "Bygge",
      modeLabel: "läge",
      displayLabel: "visning",
      installedPwa: "installerad PWA (fristående)",
      browserTab: "webbläsarflik",
    },
    logs: {
      intro:
        "Den inbyggda loggbufferten, renderad live från ramverkets loggmodul.",
      logsTitle: "Loggar",
    },
  },
};
