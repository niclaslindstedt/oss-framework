// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The appearance editor: a controlled picker over a `ThemeAppearance` — the
// exact shape `useApplyTheme` projects — covering the theme mode/variant, the
// font family and text size, and (when Custom is active) the per-slot colours
// and the shape / motion controls. It is the shared, drift-prone settings UI
// the source apps each maintained a copy of (`notes` AppearanceSection,
// `checklist` appearance tab); the framework owns one editor both render.
//
// It is presentation only: it never persists. Edits flow straight to
// `onChange`, so a host streams them to its own appearance store (and, while a
// dialog is open, to `useApplyTheme` for a live preview). `SettingsModal`
// wraps this in the framework's self-contained overlay; an app that already
// has a settings dialog embeds `AppearancePicker` directly.
//
// The data labels (theme names, colour names, font faces) come from the theme
// data modules; the section / field strings default to English and are
// overridable via `labels` so an app can localize the chrome without
// re-implementing the controls.

import { useEffect } from "react";

import { Field, Section, ToggleRow } from "../components/index.ts";
import { customThemeSeed } from "./custom-theme.ts";
import type { ThemeAppearance } from "./engine.ts";
import { ThemePreview } from "./ThemePreview.tsx";
import { loadAllFontFamilies } from "./fonts.ts";
import {
  COLOR_GROUPS,
  COLOR_LABELS,
  DEFAULT_CUSTOM_THEME_COLORS_DARK,
  PRESET_PALETTES,
  type CustomThemeColors,
} from "./palettes.ts";
import type { UiStyle } from "./ui-style.ts";
import {
  BORDER_WIDTH_PRESETS,
  BUTTON_STYLE_PRESETS,
  CONTROL_STYLE_PRESETS,
  DARK_THEMES,
  DENSITY_PRESETS,
  ELEVATION_PRESETS,
  FAMILY_DEFAULT_THEME,
  FAMILY_LABELS,
  FONT_FAMILIES,
  FONT_SCALE_PRESETS,
  LIGHT_THEMES,
  RADIUS_PRESETS,
  THEME_LABELS,
  themeFamily,
  type BorderWidthPreset,
  type ButtonStylePreset,
  type ControlStylePreset,
  type DensityPreset,
  type ElevationPreset,
  type FontFamilyId,
  type RadiusPreset,
  type ThemeFamily,
  type ThemePreset,
} from "./presets.ts";

// The section / field strings the editor renders. Default to English; override
// any subset via the `labels` prop. The theme names, colour names, and font
// faces are not here — those come from the theme data modules.
export type AppearanceLabels = {
  // "Theme" section heading.
  theme: string;
  // "Mode" field — the broad family row (Dark / Light / System / Custom).
  mode: string;
  // "Variant" field — the preset row shown for the Dark / Light families.
  variant: string;
  // Hint shown under the mode row while System is selected.
  systemNote: string;
  // "Font" section heading.
  font: string;
  // "Font" field label (the family row).
  fontFamily: string;
  // "Text size" field label (the scale row).
  textSize: string;
  // "Shape & motion" section heading.
  shapeMotion: string;
  // "Corner radius" field label.
  cornerRadius: string;
  // "Density" field label.
  density: string;
  // "Border width" field label.
  borderWidth: string;
  // "Reduce motion" toggle label.
  reduceMotion: string;
  // Hint under the reduce-motion toggle.
  reduceMotionHint: string;
  // "Components" section heading.
  components: string;
  // "Buttons" field label (the button-style row).
  buttonStyle: string;
  // "Checkboxes" field label (the control-style row).
  controlStyle: string;
  // "Elevation" field label (the shadow-depth row).
  elevation: string;
  // "Colours" section heading (Custom only).
  colours: string;
  // "Preview" field label (the live Custom preview).
  preview: string;
};

export const DEFAULT_APPEARANCE_LABELS: AppearanceLabels = {
  theme: "Theme",
  mode: "Mode",
  variant: "Variant",
  systemNote: "Follows your device's light / dark setting.",
  font: "Font",
  fontFamily: "Font",
  textSize: "Text size",
  shapeMotion: "Shape & motion",
  cornerRadius: "Corner radius",
  density: "Density",
  borderWidth: "Border width",
  reduceMotion: "Reduce motion",
  reduceMotionHint: "Minimise animations and transitions.",
  components: "Components",
  buttonStyle: "Buttons",
  controlStyle: "Checkboxes",
  elevation: "Elevation",
  colours: "Colours",
  preview: "Preview",
};

// Friendly labels for the shape presets — nicer than capitalising the ids
// ("Small" beats "Sm"). The numeric mapping lives in the engine; this is
// display copy only.
const RADIUS_LABELS: Record<RadiusPreset, string> = {
  none: "None",
  sm: "Small",
  md: "Medium",
  lg: "Large",
};
const DENSITY_LABELS: Record<DensityPreset, string> = {
  compact: "Compact",
  comfortable: "Comfortable",
  spacious: "Spacious",
};
const BORDER_WIDTH_LABELS: Record<BorderWidthPreset, string> = {
  thin: "Thin",
  normal: "Normal",
  bold: "Bold",
};
const ELEVATION_LABELS: Record<ElevationPreset, string> = {
  flat: "Flat",
  raised: "Raised",
  floating: "Floating",
};
const BUTTON_STYLE_LABELS: Record<ButtonStylePreset, string> = {
  soft: "Soft",
  solid: "Solid",
  outline: "Outline",
  ghost: "Ghost",
};
const CONTROL_STYLE_LABELS: Record<ControlStylePreset, string> = {
  square: "Square",
  rounded: "Rounded",
  circle: "Circle",
};

export function AppearancePicker({
  appearance,
  onChange,
  labels,
}: {
  appearance: ThemeAppearance;
  onChange: (next: ThemeAppearance) => void;
  labels?: Partial<AppearanceLabels>;
}) {
  const text = { ...DEFAULT_APPEARANCE_LABELS, ...labels };
  const isCustom = appearance.theme === "custom";
  const family = themeFamily(appearance.theme);

  // The non-default font families load on demand; pull them all in when the
  // picker mounts so each preview renders in its real face, not the fallback.
  useEffect(() => {
    loadAllFontFamilies();
  }, []);

  function update<K extends keyof ThemeAppearance>(
    key: K,
    value: ThemeAppearance[K],
  ): void {
    onChange({ ...appearance, [key]: value });
  }

  function handleThemeChange(next: ThemePreset): void {
    if (next === "custom" && appearance.theme !== "custom") {
      // Snapshot the theme currently on screen into the Custom controls so the
      // editor opens as a copy of what the user is looking at and the first
      // edit is a tweak, not a reset.
      const prefersLight =
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-color-scheme: light)").matches;
      onChange({
        ...appearance,
        theme: next,
        customTheme: customThemeSeed(appearance.theme, prefersLight),
      });
      return;
    }
    update("theme", next);
  }

  function updateUi<K extends keyof UiStyle>(key: K, value: UiStyle[K]): void {
    update("ui", { ...appearance.ui, [key]: value });
  }

  function updateColor(key: keyof CustomThemeColors, value: string): void {
    update("customTheme", {
      ...appearance.customTheme,
      colors: { ...appearance.customTheme.colors, [key]: value },
    });
  }

  return (
    <>
      <Section title={text.theme}>
        <Field label={text.mode}>
          <ThemeModeRow
            value={appearance.theme}
            onChange={handleThemeChange}
            customColors={appearance.customTheme.colors}
          />
          {appearance.theme === "system" && (
            <p className="text-xs text-muted">{text.systemNote}</p>
          )}
        </Field>
        {(family === "dark" || family === "light") && (
          <Field label={text.variant}>
            <ThemeVariantRow
              value={appearance.theme}
              onChange={handleThemeChange}
            />
          </Field>
        )}
      </Section>

      <Section title={text.font}>
        <Field label={text.fontFamily}>
          <FontFamilyRow
            value={appearance.fontFamily}
            onChange={(v) => update("fontFamily", v)}
          />
        </Field>
        <Field label={text.textSize}>
          <SegmentedRow<number>
            ariaLabel={text.textSize}
            value={appearance.fontScale}
            options={FONT_SCALE_PRESETS.map((p) => ({
              value: p.scale,
              label: p.label,
            }))}
            onChange={(v) => update("fontScale", v)}
          />
        </Field>
      </Section>

      <Section title={text.shapeMotion}>
        <Field label={text.cornerRadius}>
          <SegmentedRow<RadiusPreset>
            ariaLabel={text.cornerRadius}
            value={appearance.ui.radius}
            options={RADIUS_PRESETS.map((p) => ({
              value: p,
              label: RADIUS_LABELS[p],
            }))}
            onChange={(v) => updateUi("radius", v)}
          />
        </Field>
        <Field label={text.density}>
          <SegmentedRow<DensityPreset>
            ariaLabel={text.density}
            value={appearance.ui.density}
            options={DENSITY_PRESETS.map((p) => ({
              value: p,
              label: DENSITY_LABELS[p],
            }))}
            onChange={(v) => updateUi("density", v)}
          />
        </Field>
        <Field label={text.borderWidth}>
          <SegmentedRow<BorderWidthPreset>
            ariaLabel={text.borderWidth}
            value={appearance.ui.borderWidth}
            options={BORDER_WIDTH_PRESETS.map((p) => ({
              value: p,
              label: BORDER_WIDTH_LABELS[p],
            }))}
            onChange={(v) => updateUi("borderWidth", v)}
          />
        </Field>
        <ToggleRow
          label={text.reduceMotion}
          hint={text.reduceMotionHint}
          checked={appearance.ui.reduceMotion}
          onChange={(v) => updateUi("reduceMotion", v)}
        />
      </Section>

      <Section title={text.components}>
        <Field label={text.buttonStyle}>
          <SegmentedRow<ButtonStylePreset>
            ariaLabel={text.buttonStyle}
            value={appearance.ui.buttonStyle}
            options={BUTTON_STYLE_PRESETS.map((p) => ({
              value: p,
              label: BUTTON_STYLE_LABELS[p],
            }))}
            onChange={(v) => updateUi("buttonStyle", v)}
          />
        </Field>
        <Field label={text.controlStyle}>
          <SegmentedRow<ControlStylePreset>
            ariaLabel={text.controlStyle}
            value={appearance.ui.controlStyle}
            options={CONTROL_STYLE_PRESETS.map((p) => ({
              value: p,
              label: CONTROL_STYLE_LABELS[p],
            }))}
            onChange={(v) => updateUi("controlStyle", v)}
          />
        </Field>
        <Field label={text.elevation}>
          <SegmentedRow<ElevationPreset>
            ariaLabel={text.elevation}
            value={appearance.ui.elevation}
            options={ELEVATION_PRESETS.map((p) => ({
              value: p,
              label: ELEVATION_LABELS[p],
            }))}
            onChange={(v) => updateUi("elevation", v)}
          />
        </Field>
      </Section>

      {isCustom && (
        <Section title={text.colours}>
          <Field label={text.preview}>
            <ThemePreview
              colors={appearance.customTheme.colors}
              className="w-44"
            />
          </Field>
          {COLOR_GROUPS.map((group) => (
            <Field key={group.id} label={group.label}>
              <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-x-2 gap-y-2.5">
                {group.keys.map((k) => (
                  <ColorSwatchInput
                    key={k}
                    label={COLOR_LABELS[k]}
                    value={appearance.customTheme.colors[k]}
                    onChange={(c) => updateColor(k, c)}
                  />
                ))}
              </div>
            </Field>
          ))}
        </Section>
      )}
    </>
  );
}

// ── Presentational primitives ────────────────────────────────────────────
// `Section` / `Field` / `ToggleRow` come from the framework's `components`
// module. `SegmentedRow` stays local: unlike the shared `SegmentedControl`
// (string options only) it admits a numeric value, which the font-size row
// needs (`FONT_SCALE_PRESETS` are numbers).

/** A segmented control: a row of mutually-exclusive buttons. */
function SegmentedRow<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (next: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex overflow-hidden rounded border border-line"
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={`cursor-pointer border-0 px-3 py-1.5 text-sm tabular-nums ${
              active
                ? "bg-accent/15 text-accent"
                : "bg-surface-2 text-fg hover:bg-surface-3"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Theme rows ───────────────────────────────────────────────────────────

// Per-preset display swatches for the picker buttons. `system` renders the
// dark+light combo as a diagonal split; `custom` reads the user's palette so
// the swatch tracks edits live.
function ThemeSwatches({
  theme,
  customColors,
}: {
  theme: ThemePreset;
  customColors?: CustomThemeColors;
}) {
  if (theme === "system") {
    return (
      <span
        aria-hidden
        className="inline-block h-4 w-4 shrink-0 rounded-sm border border-line"
        style={{
          background:
            "linear-gradient(135deg, #1d2027 0 50%, #eef0f2 50% 100%)",
        }}
      />
    );
  }
  const palette =
    theme === "custom"
      ? (customColors ?? DEFAULT_CUSTOM_THEME_COLORS_DARK)
      : PRESET_PALETTES[theme];
  const tones = [palette.pageBg, palette.surface, palette.fg, palette.accent];
  return (
    <span
      aria-hidden
      className="inline-flex h-4 gap-px overflow-hidden rounded-sm border border-line"
    >
      {tones.map((c, i) => (
        <span
          key={i}
          className="block h-full w-1.5"
          style={{ background: c }}
        />
      ))}
    </span>
  );
}

// Mode row — the broad family pick. Selecting the family the user is already
// in is a no-op (keeps the active variant); selecting a new family jumps to
// that family's default preset.
const MODE_ORDER: readonly ThemeFamily[] = [
  "dark",
  "light",
  "system",
  "custom",
];

function ThemeModeRow({
  value,
  onChange,
  customColors,
}: {
  value: ThemePreset;
  onChange: (next: ThemePreset) => void;
  customColors: CustomThemeColors;
}) {
  const activeFamily = themeFamily(value);
  return (
    <div role="radiogroup" className="flex flex-wrap gap-2">
      {MODE_ORDER.map((fam) => {
        const active = activeFamily === fam;
        const base =
          "flex cursor-pointer items-center gap-2 rounded border px-2 py-1.5 text-sm transition-opacity focus-visible:outline-none";
        const cls = active
          ? "border-accent bg-surface-2 text-fg-bright"
          : "border-line bg-transparent text-muted opacity-60 hover:border-accent hover:opacity-100";
        return (
          <button
            key={fam}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={FAMILY_LABELS[fam]}
            onClick={() => {
              if (active) return;
              onChange(FAMILY_DEFAULT_THEME[fam]);
            }}
            className={`${base} ${cls}`}
          >
            <ThemeSwatches
              theme={FAMILY_DEFAULT_THEME[fam]}
              customColors={customColors}
            />
            <span>{FAMILY_LABELS[fam]}</span>
          </button>
        );
      })}
    </div>
  );
}

// Variant row — appears only for the Dark / Light families. A gallery of live
// preview cards (one per preset in the family), so the themes are told apart by
// how they actually look, not by name. Each card renders the real palette
// through `ThemePreview`; the active one is ringed.
function ThemeVariantRow({
  value,
  onChange,
}: {
  value: ThemePreset;
  onChange: (next: ThemePreset) => void;
}) {
  const family = themeFamily(value);
  const variants =
    family === "dark" ? DARK_THEMES : family === "light" ? LIGHT_THEMES : null;
  if (!variants) return null;
  return (
    <div
      role="radiogroup"
      className="grid w-full grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-2.5"
    >
      {variants.map((theme) => {
        const active = value === theme;
        return (
          <button
            key={theme}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={THEME_LABELS[theme]}
            onClick={() => onChange(theme)}
            className={`flex cursor-pointer flex-col gap-1.5 rounded-md border p-1.5 text-left transition-colors focus-visible:outline-none ${
              active
                ? "border-accent bg-surface-2"
                : "border-line bg-transparent hover:border-accent"
            }`}
          >
            <ThemePreview colors={PRESET_PALETTES[theme]} />
            <span
              className={`px-0.5 text-xs ${active ? "font-medium text-fg-bright" : "text-muted"}`}
            >
              {THEME_LABELS[theme]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Font-family picker as a wrap-friendly radio row, each option previewed in
// its own face.
function FontFamilyRow({
  value,
  onChange,
}: {
  value: FontFamilyId;
  onChange: (next: FontFamilyId) => void;
}) {
  return (
    <div role="radiogroup" className="flex flex-wrap gap-2">
      {FONT_FAMILIES.map((f) => {
        const active = value === f.id;
        const base =
          "cursor-pointer rounded border px-3 py-1.5 text-sm transition-opacity focus-visible:outline-none";
        const cls = active
          ? "border-accent bg-surface-2 text-fg-bright"
          : "border-line bg-transparent text-muted opacity-60 hover:border-accent hover:opacity-100";
        return (
          <button
            key={f.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(f.id)}
            className={`${base} ${cls}`}
            style={{ fontFamily: f.stack }}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
}

// Native colour input captioned beneath the swatch. Native is the right call:
// the colour controls want the OS hex entry, and the swatch itself doubles as
// the trigger.
function ColorSwatchInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <label className="flex cursor-pointer flex-col gap-1 text-xs text-muted">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="h-7 w-full cursor-pointer rounded border border-line bg-transparent p-0"
      />
      <span className="leading-tight">{label}</span>
    </label>
  );
}
