// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Shared UI primitives — the consistent design vocabulary an app builds its
// surfaces from: dialogs, buttons, form controls, dropdowns, and the inline
// glyph set they wear. Every primitive paints through the framework's theme
// token vocabulary (the `accent` / `surface` / `line` / `danger` slots and
// the `--radius-*` corners), so they follow the active theme with no extra
// wiring. They carry no i18n, no app domain types, and no asset imports —
// strings that face the user (a dialog's close label, an input's clear
// label) inject as props with English defaults.

export { Avatar, type AvatarSize } from "./Avatar.tsx";
export { Button, type ButtonVariant } from "./Button.tsx";
export { Badge, type BadgeTone } from "./Badge.tsx";
export {
  IconButton,
  ICON_BUTTON_CLASS,
  ICON_BUTTON_STATE_CLASS,
} from "./IconButton.tsx";
export {
  BottomNav,
  stepDirection,
  type BottomNavProps,
  type BottomNavItem,
  type StepDirection,
} from "./BottomNav.tsx";
export { Fab } from "./Fab.tsx";
export { FabMenu, type FabMenuAction } from "./FabMenu.tsx";
export {
  CopyButton,
  type CopyButtonProps,
  type CopyButtonLabels,
} from "./CopyButton.tsx";
export { Checkbox, CheckboxGlyph } from "./Checkbox.tsx";
export { ClearableInput } from "./ClearableInput.tsx";
export { InlineEditRow } from "./InlineEditRow.tsx";
export {
  InlineEditField,
  INLINE_EDIT_FIELD_CLASS,
} from "./InlineEditField.tsx";
export {
  LabeledDateInput,
  LabeledInput,
  LabeledTextarea,
  LABELED_FIELD_CLASS,
} from "./LabeledField.tsx";
export { ReorderButtons, type ReorderButtonsProps } from "./ReorderButtons.tsx";
export { SelectPicker, type SelectOption } from "./SelectPicker.tsx";
export { RowActionMenu, type RowAction } from "./RowActionMenu.tsx";
export { ContextMenu } from "./ContextMenu.tsx";
export {
  SwipeDeck,
  DECK_SCROLLER,
  DECK_HOME,
  DECK_END,
  type SwipeDeckProps,
  type DeckAxis,
  type DeckNav,
  type DeckRelative,
} from "./SwipeDeck.tsx";
export {
  SwipeableRow,
  type SwipeableRowProps,
  type SwipeSide,
  type SwipeActionButton,
} from "./SwipeableRow.tsx";
export { SegmentedControl, type SegmentOption } from "./SegmentedControl.tsx";
export { Section, Field, ToggleRow } from "./SettingsLayout.tsx";
export { Modal } from "./Modal.tsx";
export { useDialogDrag, type DialogDrag } from "./useDialogDrag.ts";
export {
  ConfirmDialog,
  type ConfirmTone,
  type ConfirmDialogLabels,
} from "./ConfirmDialog.tsx";
export { CipherGlyph } from "./CipherGlyph.tsx";
export { UnlockGate, type UnlockGateLabels } from "./UnlockGate.tsx";
export { FloatingPanel } from "./FloatingPanel.tsx";
export { AnchoredFlash, type AnchoredFlashProps } from "./AnchoredFlash.tsx";
export {
  ActionPill,
  type ActionPillProps,
  type ActionPillTone,
  type PillAction,
} from "./ActionPill.tsx";
export { DismissBackdrop } from "./DismissBackdrop.tsx";
export {
  PullToRefreshIndicator,
  type PullToRefreshLabels,
} from "./PullToRefreshIndicator.tsx";
export {
  createToastStore,
  defaultToastStore,
  useToasts,
  type Toast,
  type ToastAction,
  type ToastInput,
  type ToastKind,
  type ToastStore,
  type ToastStoreOptions,
} from "./toast.ts";
export { ToastViewport, type ToastViewportLabels } from "./ToastViewport.tsx";
export { APP_VIEWPORT_RECT } from "./appViewportRect.ts";
export {
  useFloatingPosition,
  computeFloatingRect,
  type FloatingAnchor,
  type FloatingPlacement,
  type FloatingPoint,
  type FloatingWidth,
  type FloatingRect,
} from "./useFloatingPosition.ts";
export * from "./icons.tsx";
