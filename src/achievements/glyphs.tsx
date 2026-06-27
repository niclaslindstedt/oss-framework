import type { ReactNode } from "react";

// Chrome glyphs for the achievements UI — the trophy on the button and modal
// headers, and the four tier badges. These are the module's own chrome; the
// per-achievement glyphs come from your catalog (any `Glyph`, e.g. the
// framework's `/components` icons or `/glyphs` set). Traced from Lucide's 24×24
// grid so they share its weight, inlined to keep the framework dependency-free.

type IconProps = { className?: string };

// Shared 24×24 stroked-icon frame so each glyph below is just its paths.
function Svg({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable={false}
      className={className}
    >
      {children}
    </svg>
  );
}

export function TrophyGlyph({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </Svg>
  );
}

export function SproutGlyph({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M7 20h10" />
      <path d="M12 20c0-6 0-8 0-10" />
      <path d="M12 10C12 6 9 4 5 4c0 4 3 6 7 6Z" />
      <path d="M12 10c0-3 2-5 6-5 0 3-2 5-6 5Z" />
    </Svg>
  );
}

export function CompassGlyph({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </Svg>
  );
}

export function WorkflowGlyph({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <path d="M7 10v4a2 2 0 0 0 2 2h5" />
    </Svg>
  );
}

export function WandGlyph({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="m4 20 12-12" />
      <path d="m15 5 1.5 1.5" />
      <path d="M18 3v3M20.5 4.5H17.5" />
      <path d="M19 13v3M20.5 14.5H17.5" />
      <path d="M9 4v2M10 5H8" />
    </Svg>
  );
}
