// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { CSSProperties, ReactNode } from "react";

// An entity's face, in one component for every size it appears at: a round
// mark that identifies a row, a card header, or a hero identity block. The
// caller hands it the best identity material it has and the avatar renders
// the first layer of the cascade that's present:
//
//   1. `src`      — a picture, drawn full-bleed in the circle;
//   2. `icon`     — a caller-picked glyph (sized to the avatar's size);
//   3. `initials` — a monogram (the caller computes the letters);
//   4. `fallback` — the caller's last-resort mark (a neutral silhouette,
//                   a shape, …); with nothing at all, the disc renders empty.
//
// `tintColor` colours the disc's text/glyph (a per-entity accent); glyph
// nodes pick it up through `currentColor`. The five sizes step from a dense
// nav row (`xs`) through list densities (`sm`, `lg`) and a header trigger
// (`md`) up to the hero identity block (`xl`).

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

const DIMS: Record<AvatarSize, string> = {
  xs: "h-5 w-5 text-[9px]",
  sm: "h-10 w-10 text-sm",
  md: "h-12 w-12 text-base",
  lg: "h-16 w-16 text-xl",
  xl: "h-24 w-24 text-3xl",
};
const ICON_DIMS: Record<AvatarSize, string> = {
  xs: "h-3.5 w-3.5",
  sm: "h-5 w-5",
  md: "h-6 w-6",
  lg: "h-8 w-8",
  xl: "h-10 w-10",
};

type Props = {
  /** Image to draw; when set it wins over every other layer. */
  src?: string | null;
  /** Glyph drawn when there is no image; sized to the avatar's size. */
  icon?: ReactNode;
  /** Monogram drawn when there is no image and no glyph. */
  initials?: string;
  /** Last-resort mark when nothing above is present. */
  fallback?: ReactNode;
  /** Accent colour for the disc's glyph/monogram (CSS color value). */
  tintColor?: string | null;
  size?: AvatarSize;
  /** Alt text for the image layer; decorative (empty) by default. */
  alt?: string;
  className?: string;
};

export function Avatar({
  src,
  icon,
  initials,
  fallback,
  tintColor,
  size = "md",
  alt = "",
  className = "",
}: Props) {
  const dim = DIMS[size];
  const iconDim = ICON_DIMS[size];
  const tint: CSSProperties | undefined = tintColor
    ? { color: tintColor }
    : undefined;

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={`${dim} shrink-0 rounded-full object-cover ${className}`.trim()}
      />
    );
  }

  // Glyph nodes arrive as plain ReactNodes, so the avatar sizes them from the
  // outside: a wrapper span carries the per-size dimensions and stretches an
  // SVG child to fill it, keeping the caller's node free of size classes.
  const glyph = (node: ReactNode) => (
    <span
      className={`flex ${iconDim} shrink-0 items-center justify-center [&>svg]:h-full [&>svg]:w-full`}
    >
      {node}
    </span>
  );

  return (
    <span
      className={`flex ${dim} shrink-0 items-center justify-center rounded-full border border-line bg-surface-2 font-semibold ${className}`.trim()}
      style={tint}
    >
      {icon ? (
        glyph(icon)
      ) : initials ? (
        <span aria-hidden>{initials}</span>
      ) : fallback ? (
        glyph(fallback)
      ) : null}
    </span>
  );
}
