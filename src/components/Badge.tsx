// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { ReactNode } from "react";

// A small count / status pill — the rounded chip a nav row wears to show an
// item count, or a section a tally. Sized to sit inline at the end of a row;
// the `tone` picks the colour pairing from the theme slots.

export type BadgeTone = "neutral" | "accent" | "muted";

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: "bg-surface-3 text-fg",
  accent: "bg-accent/20 text-accent",
  muted: "bg-surface-2 text-muted",
};

type Props = {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
};

export function Badge({ children, tone = "neutral", className = "" }: Props) {
  return (
    <span
      className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-center text-xs leading-5 font-medium ${TONE_CLASS[tone]} ${className}`.trim()}
    >
      {children}
    </span>
  );
}
