// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// An external toast store: a small, capped stack of transient notices with a
// pub/sub layer, following the same factory pattern as `logging/log-store.ts`
// — call `createToastStore()` once at module scope, push into it from
// anywhere (a store action, a sync callback, an event handler), and render
// it with `ToastViewport` (or your own component) via the `useToasts` hook.
//
// The store is deliberately mechanism-only. It knows nothing about what a
// toast announces — the app supplies the message, the kind, and (optionally)
// an `action`, the generic "do something about this notice" seam an app
// typically wires to an undo. Timing (auto-dismiss, pause on hover/focus) is
// the *renderer's* job: the store records each toast's requested duration but
// runs no timers itself, so a headless test can drive it synchronously.
//
//   const toasts = createToastStore();
//   toasts.push({ message: "Item removed", action: { label: "Undo", onAction: restore } });
//   toasts.push({ message: "Copied", kind: "success", durationMs: 2000 });

import { useCallback, useRef, useSyncExternalStore } from "react";

/**
 * Visual/semantic flavor of a toast. `info` is the neutral default;
 * `success` confirms an operation; `danger` reports a failure (and renders
 * with `role="alert"` so assistive tech announces it assertively).
 */
export type ToastKind = "info" | "success" | "danger";

/**
 * The optional action slot on a toast — a single labelled button the renderer
 * shows next to the message. The label is app-supplied (the framework has no
 * vocabulary for what the action *means*); activating it runs `onAction` and
 * dismisses the toast.
 */
export type ToastAction = {
  label: string;
  onAction: () => void;
};

/** What a caller hands to `push` — everything but `message` is optional. */
export type ToastInput = {
  message: string;
  /** Default `"info"`. */
  kind?: ToastKind;
  /**
   * How long the toast stays before auto-dismissing, in milliseconds.
   * Defaults to the store's `defaultDurationMs`. Pass `0` (or any
   * non-positive / non-finite value) for a sticky toast that only goes away
   * via its dismiss button, its action, or `dismiss(id)`.
   */
  durationMs?: number;
  action?: ToastAction;
};

/** A stacked toast as the store holds it — `ToastInput` with defaults filled
 *  in and a store-assigned id. */
export type Toast = {
  id: string;
  message: string;
  kind: ToastKind;
  durationMs: number;
  action?: ToastAction;
};

/** Knobs for a store; every field has a sensible default. */
export type ToastStoreOptions = {
  /** Stack cap; pushing beyond it drops the oldest toast. Default 5. */
  maxToasts?: number;
  /** Duration used when `push` gets no `durationMs`. Default 5000ms. */
  defaultDurationMs?: number;
};

/** The public surface of a toast store. */
export type ToastStore = {
  /** Stack a toast (dropping the oldest past the cap); returns its id. */
  push: (input: ToastInput) => string;
  /** Remove one toast by id. A no-op for an unknown id. */
  dismiss: (id: string) => void;
  /** Remove every toast. */
  clear: () => void;
  /** A snapshot copy of the current stack (oldest first). */
  getToasts: () => Toast[];
  /** Subscribe to stack changes (push / dismiss / clear); returns an unsubscribe. */
  subscribe: (cb: () => void) => () => void;
};

const DEFAULT_MAX_TOASTS = 5;
const DEFAULT_DURATION_MS = 5000;

let nextId = 0;

/**
 * Create an isolated toast store. Each store owns its own stack and
 * subscribers — call once at module scope and share the returned object
 * between the code that pushes and the `ToastViewport` that renders.
 */
export function createToastStore(options: ToastStoreOptions = {}): ToastStore {
  const maxToasts = options.maxToasts ?? DEFAULT_MAX_TOASTS;
  const defaultDurationMs = options.defaultDurationMs ?? DEFAULT_DURATION_MS;

  const stack: Toast[] = [];
  const subscribers = new Set<() => void>();

  function notify(): void {
    for (const cb of subscribers) {
      try {
        cb();
      } catch {
        // A subscriber error must not break the pusher.
      }
    }
  }

  function push(input: ToastInput): string {
    const id = `toast-${++nextId}`;
    stack.push({
      id,
      message: input.message,
      kind: input.kind ?? "info",
      durationMs: input.durationMs ?? defaultDurationMs,
      action: input.action,
    });
    if (stack.length > maxToasts) {
      stack.splice(0, stack.length - maxToasts);
    }
    notify();
    return id;
  }

  function dismiss(id: string): void {
    const index = stack.findIndex((t) => t.id === id);
    if (index === -1) return;
    stack.splice(index, 1);
    notify();
  }

  function clear(): void {
    if (stack.length === 0) return;
    stack.length = 0;
    notify();
  }

  return {
    push,
    dismiss,
    clear,
    getToasts: () => stack.slice(),
    subscribe(cb) {
      subscribers.add(cb);
      return () => {
        subscribers.delete(cb);
      };
    },
  };
}

/**
 * A ready-to-use store for apps that only ever want one toast surface. Apps
 * that need isolated stacks (or their own caps) call `createToastStore`.
 */
export const defaultToastStore: ToastStore = createToastStore();

/**
 * Subscribe a component to a {@link ToastStore}'s stack and re-render as it
 * changes — the live wiring `ToastViewport` uses. Mirrors `useLogs`: the
 * store's `getToasts()` returns a fresh array on every call, which
 * `useSyncExternalStore` cannot be handed directly (a new reference each
 * render reads as a perpetual change and loops forever), so the last snapshot
 * is cached in a ref and only refreshed when the store actually notifies.
 */
export function useToasts(store: ToastStore): Toast[] {
  // Seeded once; thereafter refreshed only inside the subscribe callback.
  const cache = useRef<Toast[] | null>(null);
  if (cache.current === null) cache.current = store.getToasts();

  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      store.subscribe(() => {
        cache.current = store.getToasts();
        onStoreChange();
      }),
    [store],
  );

  const getSnapshot = useCallback(
    () => cache.current ?? store.getToasts(),
    [store],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
