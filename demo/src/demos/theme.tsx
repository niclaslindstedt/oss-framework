// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useState } from "react";

import {
  AppearancePicker,
  SettingsModal,
  type ThemeAppearance,
} from "@niclaslindstedt/oss-framework/theme";

type Props = {
  appearance: ThemeAppearance;
  onChange: (next: ThemeAppearance) => void;
};

// Demonstrates the theme module end to end: the SettingsModal and the inline
// AppearancePicker both edit one `ThemeAppearance`, projected onto <html> by
// the single `useApplyTheme` the demo shell owns (see `App.tsx`) so the entire
// page repaints live as the controls change. The sample chrome below is built
// from the framework's semantic colour slots so a theme switch is immediately
// visible.
export function ThemeDemo({ appearance, onChange: setAppearance }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-fg-bright">Theme</h2>
          <p className="text-sm text-muted">
            The settings modal and the appearance picker drive the same theme,
            applied live with <code>useApplyTheme</code>.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="cursor-pointer rounded border border-line bg-accent/15 px-3 py-1.5 text-sm font-bold text-accent hover:bg-accent/25"
        >
          Open settings
        </button>
      </div>

      <ThemePreviewCard />

      <div className="rounded-md border border-line bg-surface p-4">
        <h3 className="mb-3 text-xs font-bold tracking-wide text-muted uppercase">
          Appearance picker (embedded)
        </h3>
        <AppearancePicker appearance={appearance} onChange={setAppearance} />
      </div>

      <SettingsModal
        open={open}
        onClose={() => setOpen(false)}
        appearance={appearance}
        onChange={setAppearance}
      />
    </section>
  );
}

// A small slice of UI built from the semantic colour slots, so every theme
// change is visible at a glance.
function ThemePreviewCard() {
  return (
    <div className="rounded-md border border-line bg-surface p-4">
      <h3 className="mb-1 text-sm font-bold text-fg-bright">Preview</h3>
      <p className="mb-3 text-sm text-fg">
        Body text in <span className="text-fg-bright">bright</span> and{" "}
        <span className="text-muted">muted</span> tones, with an{" "}
        <span className="text-accent">accent</span> and a{" "}
        <span className="text-link">link</span>.
      </p>
      <div className="flex flex-wrap gap-2">
        <span className="rounded bg-surface-2 px-2 py-1 text-xs text-fg">
          surface-2
        </span>
        <span className="rounded bg-surface-3 px-2 py-1 text-xs text-fg">
          surface-3
        </span>
        <span className="rounded bg-accent/15 px-2 py-1 text-xs text-accent">
          accent
        </span>
        <span className="rounded bg-danger/15 px-2 py-1 text-xs text-danger">
          danger
        </span>
        <span className="rounded bg-success/15 px-2 py-1 text-xs text-success">
          success
        </span>
      </div>
    </div>
  );
}
