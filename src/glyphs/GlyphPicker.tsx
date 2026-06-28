// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useGridRovingTabindex } from "../hooks/useRovingTabindex.ts";
import { DEFAULT_GLYPH } from "./catalogue.ts";
import { Glyph } from "./Glyph.tsx";

// A grid of glyph buttons — the "pick an icon" surface for an entity. The
// leading cell clears any custom icon back to the default glyph (picking it is
// "no custom icon"); the rest are the named glyphs the caller passes (usually
// `GLYPH_NAMES`). Presentational: the caller owns the selected value and the
// tint colour, and is handed the new glyph (or `null` to clear) on every pick.
//
// Keyboard nav: the grid is a roving-tabindex radiogroup — a single Tab stop
// (the selected cell) enters the grid, then ArrowLeft / ArrowRight walk the
// row, ArrowUp / ArrowDown jump a row, and Home / End jump to the first / last
// cell. Enter / Space picks the focused cell through the native button. The
// painted layout is fixed at 8 columns (`grid-cols-8`), matching the hook.

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
  // The leading clear cell is index 0; the named glyphs follow. The cursor
  // seats on whatever is selected (the clear cell when `value` is null).
  const selectedIndex = value === null ? 0 : 1 + glyphs.indexOf(value);
  const { isCursorAt, registerItem, onKeyDown } = useGridRovingTabindex({
    itemCount: glyphs.length + 1,
    columns: 8,
    initialIndex: Math.max(0, selectedIndex),
    active: false,
  });
  const tintStyle = (selected: boolean) =>
    selected && tintColor ? { color: tintColor } : undefined;
  return (
    <div role="radiogroup" className="grid grid-cols-8 gap-1">
      <button
        ref={registerItem(0)}
        type="button"
        role="radio"
        aria-checked={value === null}
        aria-label={noneLabel}
        title={noneLabel}
        tabIndex={isCursorAt(0) ? 0 : -1}
        onClick={() => onChange(null)}
        onKeyDown={onKeyDown}
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
      {glyphs.map((name, i) => {
        const selected = name === value;
        const cellIndex = 1 + i;
        return (
          <button
            key={name}
            ref={registerItem(cellIndex)}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${ariaLabelPrefix} ${name}`}
            tabIndex={isCursorAt(cellIndex) ? 0 : -1}
            onClick={() => onChange(name)}
            onKeyDown={onKeyDown}
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
