// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useState } from "react";

import {
  DEFAULT_CUSTOM_THEME,
  DEFAULT_CUSTOM_THEME_COLORS_DARK,
  DEFAULT_THEME_APPEARANCE,
  useApplyTheme,
  type ThemeAppearance,
} from "@niclaslindstedt/oss-framework/theme";

import { ChecklistAppDemo } from "./demos/checklist-app.tsx";
import { ComponentsDemo } from "./demos/components.tsx";
import { SidebarDemo } from "./demos/sidebar.tsx";
import { StorageDemo } from "./demos/storage.tsx";
import { ThemeDemo } from "./demos/theme.tsx";

// The pure-black, green-accent look the apps ship — a Custom theme seeded from
// the dark palette with the page/surface slots pushed to black and the accent
// to the apps' signature green. It is the demo's default so the preview opens
// looking like the real product; the settings modal still swaps to any preset.
const APP_LOOK: ThemeAppearance = {
  ...DEFAULT_THEME_APPEARANCE,
  theme: "custom",
  customTheme: {
    ...DEFAULT_CUSTOM_THEME,
    colors: {
      ...DEFAULT_CUSTOM_THEME_COLORS_DARK,
      pageBg: "#000000",
      surface: "#0b0d10",
      surface2: "#111418",
      surface3: "#171b20",
      fg: "#c9ced6",
      fgBright: "#ffffff",
      muted: "#7c828d",
      line: "#23272e",
      accent: "#86efac",
      success: "#86efac",
    },
  },
};

// The framework's preview site. One demo per component lives under
// `src/demos/<component>.tsx` and is rendered in a section here. The shell owns
// the single `ThemeAppearance` and projects it onto <html> with `useApplyTheme`,
// so every demo repaints live as the theme changes. The flagship checklist-app
// demo opens in the apps' own black/green look.
export function App() {
  const [appearance, setAppearance] = useState<ThemeAppearance>(APP_LOOK);

  // Paint the chosen appearance onto <html> for the whole page, once.
  useApplyTheme(appearance);

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <header className="mb-10">
        <h1 className="text-2xl font-bold text-fg-bright">
          OSS Framework — demo
        </h1>
        <p className="mt-1 text-muted">
          Preview site for <code>@niclaslindstedt/oss-framework</code>.
          Component demos appear here as the framework grows.
        </p>
      </header>

      <div className="flex flex-col gap-14">
        <ChecklistAppDemo />
        <ComponentsDemo appearance={appearance} onChange={setAppearance} />
        <ThemeDemo appearance={appearance} onChange={setAppearance} />
        <SidebarDemo />
        <StorageDemo />
      </div>
    </main>
  );
}
