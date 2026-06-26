// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useEffect, useState } from "react";

// The app's own (non-theme) settings — the slice that lives beside the
// appearance store in a real app: language, how the side menu opens,
// achievements, developer mode, and a couple of editor preferences. The
// framework deliberately leaves this in the app; it only owns the appearance
// projection. Persisted to localStorage so a reload keeps your choices.

export type Language = "en" | "sv";
export type MenuMode = "swipe" | "button";

export type AppSettings = {
  language: Language;
  menuMode: MenuMode;
  disableAchievements: boolean;
  devMode: boolean;
  captureLogs: boolean;
  // Editor tab.
  spellCheck: boolean;
  monospace: boolean;
};

export const DEFAULT_SETTINGS: AppSettings = {
  language: "en",
  // The discoverable default on phones: a floating menu button. Switching to
  // "swipe" hides it and opens the drawer with an inward edge swipe instead
  // (framework `useEdgeSwipeOpen`).
  menuMode: "button",
  disableAchievements: true,
  devMode: true,
  captureLogs: false,
  spellCheck: true,
  monospace: true,
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
