// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { DEFAULT_GLYPH } from "./catalogue.ts";
import { Glyph } from "./Glyph.tsx";

// A grid of glyph buttons — the "pick an icon" surface for an entity. The
// leading cell clears any custom icon back to the default glyph (picking it is
// "no custom icon"); the rest are the named glyphs the caller passes (usually
// `GLYPH_NAMES`). Presentational: the caller owns the selected value and the
// tint colour, and is handed the new glyph (or `null` to clear) on every pick.

type Props = {
  glyphs: readonly string[];
  /** The selected glyph, or null when none is chosen (the clear cell). */
  value: string | null;
  /** Pick a glyph, or null to clear back to the default. */
  onChange: (glyph: string | null) => void;
  /** Tints the selected cell — the entity's accent colour, when set. */
  tintColor?: string | null;
  /** aria-label for the leading "no icon" cell. */
  noneLabel: string;
  /** Per-glyph aria-label prefix, e.g. "Icon" → "Icon home". */
  ariaLabelPrefix: string;
};

export function GlyphPicker({
  glyphs,
  value,
  onChange,
  tintColor,
  noneLabel,
  ariaLabelPrefix,
}: Props) {
  const tintStyle = (selected: boolean) =>
    selected && tintColor ? { color: tintColor } : undefined;
  return (
    <div role="radiogroup" className="grid grid-cols-8 gap-1">
      <button
        type="button"
        role="radio"
        aria-checked={value === null}
        aria-label={noneLabel}
        title={noneLabel}
        onClick={() => onChange(null)}
        className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded border ${
          value === null && tintColor
            ? "border-current"
            : value === null
              ? "border-accent text-accent"
              : "border-line text-muted hover:border-fg"
        }`}
        style={tintStyle(value === null)}
      >
        <Glyph name={DEFAULT_GLYPH} className="h-3.5 w-3.5" />
      </button>
      {glyphs.map((name) => {
        const selected = name === value;
        return (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${ariaLabelPrefix} ${name}`}
            onClick={() => onChange(name)}
            className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded border ${
              selected && tintColor
                ? "border-current"
                : selected
                  ? "border-accent text-accent"
                  : "border-line text-muted hover:border-fg"
            }`}
            style={tintStyle(selected)}
          >
            <Glyph name={name} className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
