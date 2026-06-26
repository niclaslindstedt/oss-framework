// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useId, type ReactNode } from "react";

import {
  Checkbox,
  SegmentedControl,
} from "@niclaslindstedt/oss-framework/components";

import type { Language } from "../useAppSettings.ts";

// The settings-layout glue that stays app-side — a bordered section card and a
// checkbox + label/hint row. The interactive controls themselves come from the
// framework (`Checkbox`, `SegmentedControl`); these just arrange them, so the
// demo carries almost no bespoke UI.

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

export function LanguagePicker({
  value,
  onChange,
}: {
  value: Language;
  onChange: (next: Language) => void;
}) {
  return (
    <SegmentedControl
      value={value}
      onChange={onChange}
      ariaLabel="Language"
      options={[
        { value: "en", label: <span>🇬🇧 English</span> },
        { value: "sv", label: <span>🇸🇪 Svenska</span> },
      ]}
    />
  );
}
