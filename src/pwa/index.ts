// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Public PWA surface. The service-worker update lifecycle and install-context
// detection extracted from the source apps, where each kept a near-identical
// copy. The host owns the service-worker *build* (the SW, `version.json`, the
// precache manifest) and supplies `workbox-window` as an optional peer
// dependency; the framework owns the drift-prone update-tracking singleton and
// the prompt UI. Re-exported here under the
// "@niclaslindstedt/oss-framework/pwa" subpath.

export {
  usePwaUpdate,
  type PwaUpdate,
  type PwaUpdateConfig,
  type PwaUpdateState,
  type PwaUpdateCheckResult,
} from "./usePwaUpdate.ts";
export {
  UpdateToast,
  DEFAULT_UPDATE_TOAST_LABELS,
  type UpdateToastProps,
  type UpdateToastLabels,
} from "./UpdateToast.tsx";
export {
  CheckForUpdatesItem,
  DEFAULT_CHECK_FOR_UPDATES_LABELS,
  type CheckForUpdatesItemProps,
  type CheckForUpdatesLabels,
} from "./CheckForUpdatesItem.tsx";
export { isStandaloneMobile, useStandaloneMobile } from "./standalone.ts";
