// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { createLogStore } from "@niclaslindstedt/oss-framework/logging";

// A single in-app log buffer for the demo, dogfooding the framework's logging
// module. The Logs settings tab renders it live through the framework's
// `LogViewer`; the app writes a realistic sample to it on boot so the tab is
// never empty (and shows the scope/level colouring off).
export const logStore = createLogStore({ logsKey: "oss-demo:checklist:logs" });
logStore.setEnabled(true);
logStore.setCaptureEnabled(true);

export const log = logStore.createLogger("app");

let seeded = false;
export function seedLogsOnce(): void {
  if (seeded) return;
  seeded = true;

  const app = logStore.createLogger("app");
  const crypto = logStore.createLogger("crypto");
  const encrypt = logStore.createLogger("encrypt");
  const dropbox = logStore.createLogger("dropbox");
  const checklist = logStore.createLogger("checklist");

  app.info("App started");
  app.info("Loaded checklist document from localStorage");
  crypto.info("deriveKey: PBKDF2 600000 iterations (124ms)");
  encrypt.info("save: encrypt ok (126ms) → 14124 B envelope");
  dropbox.info("api.dropboxapi.com/2/files/list_folder → 200 (506ms)");
  dropbox.info(
    "content.dropboxapi.com/2/files/upload checklist.json → 200 (2167ms)",
  );
  dropbox.info("api.dropboxapi.com/2/files/list_folder → 200 (363ms)");
  checklist.info("save: ok → revision=checklist.json:016552a647d7150000000");
  dropbox.warn("token expiring in 5 min — scheduling refresh");
  app.info("Service worker registered");
}
