// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Shared UI primitives — the consistent design vocabulary an app builds its
// surfaces from: dialogs, buttons, form controls, dropdowns, and the inline
// glyph set they wear. Every primitive paints through the framework's theme
// token vocabulary (the `accent` / `surface` / `line` / `danger` slots and
// the `--radius-*` corners), so they follow the active theme with no extra
// wiring. They carry no i18n, no app domain types, and no asset imports —
// strings that face the user (a dialog's close label, an input's clear
// label) inject as props with English defaults.

export { Button, type ButtonVariant } from "./Button.tsx";
export { Badge, type BadgeTone } from "./Badge.tsx";
export { Fab } from "./Fab.tsx";
export { Checkbox } from "./Checkbox.tsx";
export { ClearableInput } from "./ClearableInput.tsx";
export { SelectPicker, type SelectOption } from "./SelectPicker.tsx";
export { RowActionMenu, type RowAction } from "./RowActionMenu.tsx";
export { SegmentedControl, type SegmentOption } from "./SegmentedControl.tsx";
export { Section, Field, ToggleRow } from "./SettingsLayout.tsx";
export { Modal } from "./Modal.tsx";
export { CipherGlyph } from "./CipherGlyph.tsx";
export { FloatingPanel } from "./FloatingPanel.tsx";
export { DismissBackdrop } from "./DismissBackdrop.tsx";
export {
  PullToRefreshIndicator,
  type PullToRefreshLabels,
} from "./PullToRefreshIndicator.tsx";
export { APP_VIEWPORT_RECT } from "./appViewportRect.ts";
export {
  useFloatingPosition,
  computeFloatingRect,
  type FloatingPlacement,
  type FloatingWidth,
  type FloatingRect,
} from "./useFloatingPosition.ts";
export * from "./icons.tsx";
