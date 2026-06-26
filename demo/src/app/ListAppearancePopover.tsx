// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useRef, useState } from "react";

import { FloatingPanel } from "@niclaslindstedt/oss-framework/components";
import {
  ColorPalette,
  DEFAULT_GLYPH,
  GLYPH_COLORS,
  GLYPH_NAMES,
  Glyph,
  GlyphPicker,
} from "@niclaslindstedt/oss-framework/glyphs";

import type { List } from "./types.ts";

// The active list's "appearance" control in the screen header: a button
// wearing the list's chosen glyph (tinted by its accent colour), which opens a
// popover with the framework's glyph + colour pickers. This is the demo's
// composition of the `/glyphs` kit — the app owns the trigger, the popover
// chrome (the framework `FloatingPanel`), and *where the choice is stored* (the
// checklist store); the framework owns the catalogue, the renderer, and the two
// pickers. Editing here flows straight back into the side-menu icons and the
// browser-tab favicon.
type Props = {
  list: List;
  onChange: (patch: { glyph?: string | null; color?: string | null }) => void;
};

export function ListAppearancePopover({ list, onChange }: Props) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const tint = list.color ? { color: list.color } : undefined;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="List appearance"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-line text-muted hover:bg-surface-2 hover:text-fg"
      >
        <Glyph
          name={list.glyph ?? DEFAULT_GLYPH}
          className="h-4 w-4"
          style={tint}
        />
      </button>

      <FloatingPanel
        open={open}
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
        placement={{
          width: { kind: "min", minPx: 268 },
          anchor: "left",
          gap: 6,
          coordinateSpace: "viewport",
        }}
        className="rounded-md border border-line bg-surface-1 p-3 shadow-lg"
      >
        <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
          Colour
        </p>
        <ColorPalette
          colors={GLYPH_COLORS}
          value={list.color ?? null}
          onChange={(color) => onChange({ color })}
          ariaLabelPrefix="Colour"
        />
        <p className="mt-3 mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
          Icon
        </p>
        <GlyphPicker
          glyphs={GLYPH_NAMES}
          value={list.glyph ?? null}
          onChange={(glyph) => onChange({ glyph })}
          tintColor={list.color}
          noneLabel="Default icon"
          ariaLabelPrefix="Icon"
        />
      </FloatingPanel>
    </>
  );
}
