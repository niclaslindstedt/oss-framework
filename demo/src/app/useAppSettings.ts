// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useEffect, useState } from "react";

// The app's own (non-theme) settings — the slice that lives beside the
// appearance store in a real app: how the side menu opens, achievements,
// developer mode, and a couple of editor preferences. The framework
// deliberately leaves this in the app; it only owns the appearance projection.
// (The active *language* is owned by the framework i18n runtime — see
// `i18n/index.ts` — so it lives there, not in this store.) Persisted to
// localStorage so a reload keeps your choices.

export type MenuMode = "swipe" | "button";

/** Where the add-item composer drops a new item — the start or the end of the
 *  list. The list screen's composer reads this; "Enter on a row" always lands
 *  the next item directly below the one you're on, regardless. */
export type AddItemPosition = "top" | "bottom";

export type AppSettings = {
  menuMode: MenuMode;
  disableAchievements: boolean;
  devMode: boolean;
  captureLogs: boolean;
  // Editor tab.
  spellCheck: boolean;
  monospace: boolean;
  addItemPosition: AddItemPosition;
};

export const DEFAULT_SETTINGS: AppSettings = {
  // The discoverable default on phones: a floating sidebar button. Switching to
  // "swipe" hides it and opens the drawer with an inward edge swipe instead
  // (framework `useEdgeSwipeOpen`). Settings is reached from the sidebar footer.
  menuMode: "button",
  // Achievements ship on so the trophy button and its modals are discoverable
  // out of the box; the General tab can switch them off.
  disableAchievements: false,
  devMode: true,
  captureLogs: false,
  spellCheck: true,
  monospace: true,
  // New items append to the end of the list by default.
  addItemPosition: "bottom",
};

const STORAGE_KEY = "oss-demo:checklist:settings";

function load(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw)
      return {
        ...DEFAULT_SETTINGS,
        ...(JSON.parse(raw) as Partial<AppSettings>),
      };
  } catch {
    // ignore
  }
  return DEFAULT_SETTINGS;
}

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  const update = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
      setSettings((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const reset = useCallback(() => setSettings(DEFAULT_SETTINGS), []);

  return { settings, update, reset, setSettings };
}
