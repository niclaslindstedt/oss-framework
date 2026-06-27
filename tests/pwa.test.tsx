// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CheckForUpdatesItem,
  UpdateToast,
  isStandaloneMobile,
  useStandaloneMobile,
  usePwaUpdate,
} from "../src/pwa/index.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

// Drive `isStandaloneMobile` by faking the two signals it reads: the
// display-mode media query (or iOS `navigator.standalone`) and a mobile UA.
function stubEnv({
  standalone,
  ua,
  maxTouchPoints = 0,
}: {
  standalone: boolean;
  ua: string;
  maxTouchPoints?: number;
}) {
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: standalone && query.includes("display-mode: standalone"),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
  vi.stubGlobal("navigator", {
    userAgent: ua,
    maxTouchPoints,
    standalone: false,
  });
}

const ANDROID =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile";
const DESKTOP =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120";

describe("isStandaloneMobile", () => {
  it("is true for an installed PWA on a mobile OS", () => {
    stubEnv({ standalone: true, ua: ANDROID });
    expect(isStandaloneMobile()).toBe(true);
  });

  it("is false in a normal mobile browser tab", () => {
    stubEnv({ standalone: false, ua: ANDROID });
    expect(isStandaloneMobile()).toBe(false);
  });

  it("is false for an installed desktop window (not a mobile OS)", () => {
    stubEnv({ standalone: true, ua: DESKTOP });
    expect(isStandaloneMobile()).toBe(false);
  });

  it("treats a multi-touch Mac UA as an iPad", () => {
    stubEnv({ standalone: true, ua: DESKTOP, maxTouchPoints: 5 });
    expect(isStandaloneMobile()).toBe(true);
  });

  it("reads the flag once as a hook", () => {
    stubEnv({ standalone: true, ua: ANDROID });
    const { result } = renderHook(() => useStandaloneMobile());
    expect(result.current).toBe(true);
  });
});

describe("usePwaUpdate", () => {
  it("starts idle and never registers when disabled (no service worker)", () => {
    // `enabled: false` keeps the singleton from touching `navigator`, so this
    // is safe to call in jsdom with no service worker.
    const { result } = renderHook(() =>
      usePwaUpdate({ base: "/", cacheId: "app", enabled: false }),
    );
    expect(result.current.needRefresh).toBe(false);
    expect(result.current.progress).toBeNull();
    expect(result.current.incomingVersion).toBeNull();
    expect(typeof result.current.reload).toBe("function");
    expect(typeof result.current.dismiss).toBe("function");
    expect(result.current.checking).toBe(false);
    expect(typeof result.current.checkForUpdate).toBe("function");
  });

  it("reports `unavailable` from a manual check with no service worker", async () => {
    const { result } = renderHook(() =>
      usePwaUpdate({ base: "/", cacheId: "app", enabled: false }),
    );
    await expect(result.current.checkForUpdate()).resolves.toBe("unavailable");
  });
});

describe("CheckForUpdatesItem", () => {
  it("renders the resting label and checks on click", async () => {
    const onCheck = vi.fn().mockResolvedValue("up-to-date" as const);
    render(
      <CheckForUpdatesItem
        checking={false}
        updateAvailable={false}
        onCheck={onCheck}
      />,
    );
    const button = screen.getByRole("menuitem", { name: /check for updates/i });
    button.click();
    expect(onCheck).toHaveBeenCalledOnce();
    // The "up to date" reassurance lands once the probe resolves.
    expect(await screen.findByText("You’re up to date")).toBeTruthy();
  });

  it("shows a disabled, busy row while checking", () => {
    render(
      <CheckForUpdatesItem
        checking
        updateAvailable={false}
        onCheck={vi.fn()}
      />,
    );
    const button = screen.getByRole("menuitem");
    expect(screen.getByText("Checking for updates…")).toBeTruthy();
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
  });

  it("reads 'Update available' once a build is waiting", () => {
    render(
      <CheckForUpdatesItem
        checking={false}
        updateAvailable
        onCheck={vi.fn().mockResolvedValue("update-found" as const)}
      />,
    );
    expect(screen.getByText("Update available")).toBeTruthy();
  });

  it("keeps the resting label when a check finds an update (the prompt surfaces it)", async () => {
    const onCheck = vi.fn().mockResolvedValue("update-found" as const);
    render(
      <CheckForUpdatesItem
        checking={false}
        updateAvailable={false}
        onCheck={onCheck}
      />,
    );
    screen.getByRole("menuitem").click();
    await waitFor(() => expect(onCheck).toHaveBeenCalledOnce());
    expect(screen.getByText("Check for updates")).toBeTruthy();
    expect(screen.queryByText("You’re up to date")).toBeNull();
  });

  it("accepts label overrides", () => {
    render(
      <CheckForUpdatesItem
        checking={false}
        updateAvailable
        onCheck={vi.fn()}
        labels={{ updateAvailable: "Uppdatering tillgänglig" }}
      />,
    );
    expect(screen.getByText("Uppdatering tillgänglig")).toBeTruthy();
  });
});

describe("UpdateToast", () => {
  it("renders nothing until an update is waiting", () => {
    const { container } = render(
      <UpdateToast
        needRefresh={false}
        onReload={() => {}}
        onDismiss={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows the prompt, the version, and fires its callbacks", async () => {
    const onReload = vi.fn();
    const onDismiss = vi.fn();
    render(
      <UpdateToast
        needRefresh
        incomingVersion="1.2.3"
        onReload={onReload}
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByText("A new version is ready")).toBeTruthy();
    expect(screen.getByText("Version 1.2.3")).toBeTruthy();

    screen.getByRole("button", { name: "Update" }).click();
    expect(onReload).toHaveBeenCalledOnce();
    screen.getByRole("button", { name: "Dismiss" }).click();
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("accepts label overrides", () => {
    render(
      <UpdateToast
        needRefresh
        incomingVersion="9"
        onReload={() => {}}
        onDismiss={() => {}}
        labels={{
          ready: "Ny version klar",
          version: (v) => `v${v}`,
          dismiss: "Stäng",
        }}
      />,
    );
    expect(screen.getByText("Ny version klar")).toBeTruthy();
    expect(screen.getByText("v9")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Stäng" })).toBeTruthy();
  });
});
