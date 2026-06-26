// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useId, type ReactNode } from "react";

import { Checkbox } from "@niclaslindstedt/oss-framework/components";

import type { Language } from "../useAppSettings.ts";

// The reusable settings controls the tabs are built from — a bordered section
// card, a checkbox + label/hint row, a segmented (radio-group) toggle, and the
// language picker. Mirrors the real app's settings vocabulary.

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

export function SegmentedRow<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: readonly { value: T; label: ReactNode }[];
  onChange: (next: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex overflow-hidden rounded border border-line"
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={`flex cursor-pointer items-center gap-1.5 border-0 px-3 py-1.5 text-sm ${
              active
                ? "bg-accent/15 text-accent"
                : "bg-surface-2 text-fg hover:bg-surface-3"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

const LANGUAGES: readonly { value: Language; label: ReactNode }[] = [
  { value: "en", label: <span>🇬🇧 English</span> },
  { value: "sv", label: <span>🇸🇪 Svenska</span> },
];

export function LanguagePicker({
  value,
  onChange,
}: {
  value: Language;
  onChange: (next: Language) => void;
}) {
  return (
    <SegmentedRow
      value={value}
      options={LANGUAGES}
      onChange={onChange}
      ariaLabel="Language"
    />
  );
}
