// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useRef, useState } from "react";

import { Button } from "../components/Button.tsx";
import { CheckboxGlyph } from "../components/Checkbox.tsx";
import { FloatingPanel } from "../components/FloatingPanel.tsx";
import type { FloatingPlacement } from "../components/useFloatingPosition.ts";

// The header progress badge: a small ring that fills as items get checked,
// paired with the `checked / total` fraction. The ring and the count pick up
// the `success` accent once every item is checked, so a finished list reads at
// a glance.
//
// When `onCheckAll` / `onUncheckAll` are wired (and there are items), the badge
// becomes a button that opens a small bulk-action dropdown; otherwise it's a
// static, non-interactive readout. Strings inject as props (English defaults)
// so the component stays app-agnostic.

// Ring geometry: an 18px box with a 7px-radius track, rotated so the arc
// starts at twelve o'clock and fills clockwise.
const RING_RADIUS = 7;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const MENU_PLACEMENT: FloatingPlacement = {
  width: { kind: "min", minPx: 160 },
  anchor: "right",
  coordinateSpace: "document",
};

type Props = {
  checked: number;
  total: number;
  // Bulk-check / -uncheck every item. Provide both to turn the badge into a
  // dropdown; omit to render a static counter.
  onCheckAll?: () => void;
  onUncheckAll?: () => void;
  // Injected labels (English defaults).
  labels?: {
    progress?: (checked: number, total: number) => string;
    checkAll?: string;
    uncheckAll?: string;
  };
  className?: string;
};

export function ChecklistProgress({
  checked,
  total,
  onCheckAll,
  onUncheckAll,
  labels,
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const done = total > 0 && checked === total;
  const fraction = total > 0 ? checked / total : 0;
  const progressLabel =
    labels?.progress?.(checked, total) ?? `${checked} / ${total}`;
  const interactive = total > 0 && !!onCheckAll && !!onUncheckAll;

  const tone = done
    ? "border-success/40 text-success"
    : "border-line text-muted";

  const inner = (
    <>
      <svg viewBox="0 0 18 18" className="h-[18px] w-[18px] -rotate-90">
        <circle
          cx="9"
          cy="9"
          r={RING_RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-line"
        />
        <circle
          cx="9"
          cy="9"
          r={RING_RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={RING_CIRCUMFERENCE * (1 - fraction)}
          className={done ? "text-success" : "text-accent"}
        />
      </svg>
      <span className="text-sm font-medium tabular-nums">{progressLabel}</span>
    </>
  );

  const boxClass =
    `flex h-9 items-center gap-2 rounded-md border px-3 ${tone} ${className}`.trim();

  if (!interactive) {
    return (
      <span className={boxClass} aria-label={progressLabel}>
        {inner}
      </span>
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={progressLabel}
        className={`${boxClass} cursor-pointer hover:border-accent`}
      >
        {inner}
      </button>
      <FloatingPanel
        open={open}
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
        placement={MENU_PLACEMENT}
        className="gap-1 p-1"
      >
        <Button
          variant="ghost"
          className="flex items-center justify-start gap-2 text-left"
          onClick={() => {
            onCheckAll?.();
            setOpen(false);
          }}
        >
          {/* The "check all" / "uncheck all" rows read as checklist items
              themselves — a filled (accent) box and an empty (muted) one,
              sized `sm` to sit with the menu's smaller text. */}
          <CheckboxGlyph checked size="sm" />
          {labels?.checkAll ?? "Check all"}
        </Button>
        <Button
          variant="ghost"
          className="flex items-center justify-start gap-2 text-left"
          onClick={() => {
            onUncheckAll?.();
            setOpen(false);
          }}
        >
          <CheckboxGlyph checked={false} size="sm" />
          {labels?.uncheckAll ?? "Uncheck all"}
        </Button>
      </FloatingPanel>
    </>
  );
}
