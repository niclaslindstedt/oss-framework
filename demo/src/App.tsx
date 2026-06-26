// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useState } from "react";

import {
  DEFAULT_THEME_APPEARANCE,
  useApplyTheme,
  type ThemeAppearance,
} from "@niclaslindstedt/oss-framework/theme";

import { ComponentsDemo } from "./demos/components.tsx";
import { SidebarDemo } from "./demos/sidebar.tsx";
import { StorageDemo } from "./demos/storage.tsx";
import { ThemeDemo } from "./demos/theme.tsx";

// The framework's preview site. One demo per component lives under
// `src/demos/<component>.tsx` and is rendered in a section here. The shell owns
// the single `ThemeAppearance` and projects it onto <html> with `useApplyTheme`,
// so every demo (the UI-primitives hello-world, the theme picker, the rest)
// repaints live as the theme changes. Add further sections below as the public
// surface grows.
export function App() {
  const [appearance, setAppearance] = useState<ThemeAppearance>(
    DEFAULT_THEME_APPEARANCE,
  );

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
        <ComponentsDemo appearance={appearance} onChange={setAppearance} />
        <ThemeDemo appearance={appearance} onChange={setAppearance} />
        <SidebarDemo />
        <StorageDemo />
      </div>
    </main>
  );
}
