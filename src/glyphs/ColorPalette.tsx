// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A wrap of circular colour swatches — the "pick a colour" surface for an
// entity's accent. Presentational: the caller owns the selected value and is
// handed the new colour on every pick. A default palette lives in `colors.ts`
// (`GLYPH_COLORS`).
//
// Keyboard nav: the row is a roving-tabindex radiogroup — a single Tab stop
// (the selected swatch) enters it, then the arrow keys cycle the swatches and
// Home / End jump to the first / last. The swatches wrap visually, so a true
// row jump isn't reliable without measuring geometry; the 1-D fallback (every
// arrow walks one swatch) is right for a palette of a dozen-ish colours. Enter
// / Space picks the focused swatch through the native button.
import { useRovingTabindex } from "../hooks/useRovingTabindex.ts";

type Props = {
  colors: readonly string[];
  /** The selected colour, or null when none is chosen yet. */
  value: string | null;
  onChange: (color: string) => void;
  /** Per-swatch aria-label prefix, e.g. "Colour" → "Colour #e06c75". */
  ariaLabelPrefix: string;
};

export function ColorPalette({
  colors,
  value,
  onChange,
  ariaLabelPrefix,
}: Props) {
  const { isCursorAt, registerItem, onKeyDown } = useRovingTabindex({
    itemCount: colors.length,
    initialIndex: Math.max(0, value === null ? 0 : colors.indexOf(value)),
    active: false,
    orientation: "horizontal",
  });
  return (
    <div role="radiogroup" className="flex flex-wrap gap-1.5">
      {colors.map((c, i) => (
        <button
          key={c}
          ref={registerItem(i)}
          type="button"
          role="radio"
          aria-checked={c === value}
          aria-label={`${ariaLabelPrefix} ${c}`}
          tabIndex={isCursorAt(i) ? 0 : -1}
          onClick={() => onChange(c)}
          onKeyDown={onKeyDown}
          className={`h-6 w-6 cursor-pointer rounded-full border-2 ${
            c === value ? "border-fg-bright" : "border-transparent"
          }`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}
