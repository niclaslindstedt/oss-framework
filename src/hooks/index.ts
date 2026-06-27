// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Public hook surface. As shared hooks are migrated out of the notes /
// checklist apps (see the find-refactor-candidates skill) they are
// re-exported from here and become available under the
// "@niclaslindstedt/oss-framework/hooks" subpath.
export { useEscapeKey } from "./useEscapeKey.ts";
export { isModalOpen } from "./isModalOpen.ts";
export {
  useLongPress,
  type LongPressHandlers,
  type LongPressOptions,
} from "./useLongPress.ts";
export { useMediaQuery, useDesktopPointer } from "./useMediaQuery.ts";
export {
  useRowSwipe,
  type RowSwipe,
  type RowSwipeOptions,
  type RowSwipeSide,
} from "./useRowSwipe.ts";
export {
  usePullToRefresh,
  type PullToRefreshState,
} from "./usePullToRefresh.ts";
export {
  useUndoRedoShortcuts,
  type UndoRedoShortcutsParams,
} from "./useUndoRedoShortcuts.ts";
