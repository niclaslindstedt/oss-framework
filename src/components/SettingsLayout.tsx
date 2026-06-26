// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useId, type ReactNode } from "react";

import { Checkbox } from "./Checkbox.tsx";

// The presentational building blocks a settings surface is assembled from:
// a bordered `Section` card with an uppercase title, a labelled `Field` that
// stacks a caption over its controls, and a `ToggleRow` pairing a `Checkbox`
// with a label and optional hint. They carry no app domain and no i18n — the
// visible strings (`title`, `label`, `hint`) inject as props — and paint
// through the framework theme token vocabulary (`line` / `surface` / `muted` /
// `fg` / `accent` slots), so they follow the active theme with no extra wiring.
//
// They arrange controls; they do not own them. Drop the framework's own form
// primitives (`SegmentedControl`, `SelectPicker`, `ClearableInput`, …) inside a
// `Field`, and a `Section` becomes one group of a settings tab. A host keeps
// owning the state behind each control and the labels it passes down.

/** A labelled settings group rendered as a bordered fieldset. */
export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <div
      role="group"
      aria-labelledby={titleId}
      className="mt-3 rounded border border-line bg-surface-3 p-3 first:mt-0"
    >
      <div
        id={titleId}
        className="mb-2 text-xs font-bold tracking-wide text-muted uppercase"
      >
        {title}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

/** A labelled row that stacks a caption over a wrapping row of controls. */
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const labelId = useId();
  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className="flex flex-col gap-1.5"
    >
      <span id={labelId} className="text-xs text-muted">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

/** A checkbox row with a visible label and an optional hint beneath it. */
export function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <span className="mt-0.5">
        <Checkbox checked={checked} onChange={onChange} ariaLabel={label} />
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-sm text-fg-bright">{label}</span>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}
