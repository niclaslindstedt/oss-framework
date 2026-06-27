// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Public sidebar surface. The responsive navigation *shell* — the docked /
// drawer framing, the draggable floating button, and the pinned-inset helper
// — extracted from the notes / checklist apps, where each kept a near-
// identical copy. The host owns the nav *state* and the navigation *content*
// (passed as `children`); the framework owns the drift-prone framing. These
// are re-exported here and become available under the
// "@niclaslindstedt/oss-framework/sidebar" subpath.

export {
  Sidebar,
  DEFAULT_SIDEBAR_LABELS,
  type SidebarProps,
  type SidebarLabels,
} from "./Sidebar.tsx";
export { FloatingButton, type FloatingButtonProps } from "./FloatingButton.tsx";
export {
  type MenuButtonPosition,
  type MenuButtonSide,
  MENU_BUTTON_SIZE,
  MENU_BUTTON_MARGIN,
  clampUnit,
  restingRect,
  clampRect,
  rectToPosition,
} from "./position.ts";
export {
  useDraggableMenuButton,
  type DraggableMenuButton,
} from "./useDraggableMenuButton.ts";
export { usePersistentMenuPosition } from "./usePersistentMenuPosition.ts";
export {
  useDrawerSwipeClose,
  type DrawerSwipeClose,
} from "./useDrawerSwipeClose.ts";
export {
  useEdgeSwipeOpen,
  type EdgeSwipeOpenOptions,
} from "./useEdgeSwipeOpen.ts";
export { useSidebarInset } from "./useSidebarInset.ts";
export {
  useDragDrop,
  type DragDrop,
  type DragDropOptions,
  type DragHandleProps,
  type DropZoneProps,
} from "./useDragDrop.ts";
