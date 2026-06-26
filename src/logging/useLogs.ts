// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useRef, useSyncExternalStore } from "react";

import type { LogEntry, LogStore } from "./log-store.ts";

// Subscribe a component to a {@link LogStore}'s buffer and re-render as it
// changes — the live wiring a Logs panel needs. The store's `getLogs()`
// returns a fresh array on every call, which `useSyncExternalStore` cannot be
// handed directly (a new reference each render reads as a perpetual change and
// loops forever). This hook caches the last snapshot in a ref and only
// refreshes it when the store actually notifies, giving the stable identity
// React requires between updates.
export function useLogs(store: LogStore): LogEntry[] {
  // Seeded once; thereafter refreshed only inside the subscribe callback.
  const cache = useRef<LogEntry[] | null>(null);
  if (cache.current === null) cache.current = store.getLogs();

  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      store.subscribeToLogs(() => {
        cache.current = store.getLogs();
        onStoreChange();
      }),
    [store],
  );

  const getSnapshot = useCallback(
    () => cache.current ?? store.getLogs(),
    [store],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
