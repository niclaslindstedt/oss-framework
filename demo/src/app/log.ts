// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { createLogStore } from "@niclaslindstedt/oss-framework/logging";

// A single in-app log buffer for the demo, dogfooding the framework's logging
// module. The Logs settings tab renders it live; the app writes a few lines to
// it on boot so the tab is never empty.
export const logStore = createLogStore({ logsKey: "oss-demo:checklist:logs" });
logStore.setEnabled(true);
logStore.setCaptureEnabled(true);

export const log = logStore.createLogger("app");

let seeded = false;
export function seedLogsOnce(): void {
  if (seeded) return;
  seeded = true;
  log.info("App started");
  log.info("Loaded checklist document from localStorage");
}
