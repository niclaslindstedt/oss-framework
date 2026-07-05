// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  useState,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

// The labelled draft fields an edit form is built from: a small caption
// stacked over a bordered input (or textarea) that holds its draft **locally**
// and commits on blur — Enter, on the single-line field, just blurs to commit.
// The point of the local draft is undo granularity: a settled edit reaches the
// caller's store as one step, not a commit per keystroke, and an unchanged
// blur commits nothing at all.
//
// The draft is seeded from `value` when the field mounts and is deliberately
// *not* re-synced while the user types; remount the field (a `key` change)
// when an external change must replace an in-progress draft.
//
// `required` marks the caption (and the control) as mandatory; `invalid`
// paints the border and sets `aria-invalid`, so the caller drives exactly the
// error state it wants to show. Everything else an `<input>` / `<textarea>`
// takes — `type`, `inputMode`, `autoCapitalize`, `placeholder`, `rows`, … —
// passes straight through.

/** The bordered-field look, exported for one-off controls that must match. */
export const LABELED_FIELD_CLASS =
  "w-full min-w-0 max-w-full rounded-md border border-line bg-surface-2 px-2 py-1.5 text-sm text-fg outline-none focus:border-accent";

type LabeledInputProps = {
  /** Caption shown above the field (also its accessible name, via <label>). */
  label: string;
  /** Committed value; seeds the local draft on mount. */
  value: string;
  /** Paint the error state (`aria-invalid` + a danger border). */
  invalid?: boolean;
  /** Called with the draft on blur (or Enter), only when it changed. */
  onCommit: (next: string) => void;
} & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "defaultValue" | "onChange" | "onBlur" | "onKeyDown" | "className"
>;

export function LabeledInput({
  label,
  value,
  invalid = false,
  onCommit,
  type = "text",
  required = false,
  ...inputProps
}: LabeledInputProps) {
  const [draft, setDraft] = useState(value);
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs text-muted">
        {label}
        {required && <span className="text-danger"> *</span>}
      </span>
      <input
        {...inputProps}
        type={type}
        value={draft}
        required={required}
        aria-invalid={invalid || undefined}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== value) onCommit(draft);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className={
          invalid ? `${LABELED_FIELD_CLASS} border-danger` : LABELED_FIELD_CLASS
        }
      />
    </label>
  );
}

type LabeledTextareaProps = {
  /** Caption above the field; with `hideLabel` it becomes the aria-label. */
  label: string;
  /** Drop the visible caption but keep the accessible name. */
  hideLabel?: boolean;
  /** Committed value; seeds the local draft on mount. */
  value: string;
  /** Called with the draft on blur, only when it changed. */
  onCommit: (next: string) => void;
} & Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "defaultValue" | "onChange" | "onBlur" | "className"
>;

export function LabeledTextarea({
  label,
  hideLabel = false,
  value,
  onCommit,
  ...textareaProps
}: LabeledTextareaProps) {
  const [draft, setDraft] = useState(value);
  return (
    <label className="flex min-w-0 flex-col gap-1">
      {!hideLabel && <span className="text-xs text-muted">{label}</span>}
      <textarea
        {...textareaProps}
        aria-label={hideLabel ? label : undefined}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== value) onCommit(draft);
        }}
        className={`${LABELED_FIELD_CLASS} resize-y`}
      />
    </label>
  );
}
