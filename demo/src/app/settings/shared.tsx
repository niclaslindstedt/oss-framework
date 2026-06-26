// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { SegmentedControl } from "@niclaslindstedt/oss-framework/components";

import type { Language } from "../useAppSettings.ts";

// The only settings glue that stays app-side: a language picker that wraps the
// framework's `SegmentedControl` with this app's flag labels. The layout
// primitives the tabs are built from (`Section`, `Field`, `ToggleRow`) and the
// interactive controls (`SegmentedControl`, …) all come from the framework's
// `components` module, so the demo carries no bespoke settings UI.

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
