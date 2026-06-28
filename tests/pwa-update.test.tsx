// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The `usePwaUpdate` singleton (module-level `started`/`config`) can only be
// driven through one config per module instance, so this lives in its own file
// — a fresh module — to exercise the *enabled* registration path that
// `pwa.test.tsx` deliberately avoids (it only uses `enabled: false`).

// A controllable `workbox-window` fake: it records the lifecycle listeners the
// hook registers so a test can fire `waiting` / `controlling` by hand, and spies
// on `messageSkipWaiting`. Hoisted so the `vi.mock` factory can close over it.
const wb = vi.hoisted(() => {
  const listeners: Record<string, ((e: unknown) => void)[]> = {};
  return {
    listeners,
    messageSkipWaiting: vi.fn(),
    fire(type: string, event: unknown = {}) {
      for (const cb of listeners[type] ?? []) cb(event);
    },
  };
});

vi.mock("workbox-window", () => {
  class Workbox {
    addEventListener(type: string, cb: (e: unknown) => void) {
      (wb.listeners[type] ??= []).push(cb);
    }
    async register() {
      // A registration parked with a waiting worker — the state that surfaces
      // the prompt. `messageSkipWaiting` only needs `.waiting` to be truthy.
      return {
        installing: null,
        waiting: {},
        update: async () => {},
        addEventListener() {},
      } as unknown as ServiceWorkerRegistration;
    }
    messageSkipWaiting() {
      wb.messageSkipWaiting();
    }
  }
  return { Workbox };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("usePwaUpdate reload", () => {
  it("reloads on an explicit apply even when isUpdate is false", async () => {
    const reload = vi.fn();
    // A service worker is present so `start()` registers; `controller` is absent
    // so workbox would set `isUpdate: false` — the regression scenario (first
    // install of the session / iOS), where the old code never reloaded.
    vi.stubGlobal("navigator", {
      serviceWorker: { addEventListener() {}, controller: null },
    });
    vi.stubGlobal("location", { reload });

    const { usePwaUpdate } = await import("../src/pwa/usePwaUpdate.ts");
    const { result } = renderHook(() =>
      usePwaUpdate({ base: "/", cacheId: "app" }),
    );

    // Wait for the lazy `import("workbox-window")` + register() to wire up the
    // listeners, then raise the "a build is waiting" prompt by hand.
    await waitFor(() => expect(wb.listeners.waiting?.length).toBeTruthy());
    act(() => wb.fire("waiting"));
    await waitFor(() => expect(result.current.needRefresh).toBe(true));

    // Tap "Update": it must send SKIP_WAITING and, once the new worker takes
    // control, reload — despite isUpdate being false.
    act(() => result.current.reload());
    expect(wb.messageSkipWaiting).toHaveBeenCalledOnce();
    expect(reload).not.toHaveBeenCalled();

    act(() => wb.fire("controlling", { isUpdate: false }));
    expect(reload).toHaveBeenCalledOnce();

    // A second controllerchange (e.g. another tab) must not double-reload.
    act(() => wb.fire("controlling", { isUpdate: true }));
    expect(reload).toHaveBeenCalledOnce();
  });
});
