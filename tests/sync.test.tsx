// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SyncStatus,
  SyncDetailsModal,
  type ConnectionProbeResult,
  type SaveStatus,
} from "../src/sync/index.ts";

afterEach(() => {
  document.body.style.overflow = "";
});

describe("SyncStatus", () => {
  it("reads as synced when clean and idle", () => {
    render(
      <SyncStatus
        providerName="Dropbox"
        status="idle"
        dirty={false}
        offline={false}
        onOpenDetails={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Synced to Dropbox" }),
    ).toBeTruthy();
  });

  it("flags unsaved edits when dirty", () => {
    render(
      <SyncStatus
        providerName="Dropbox"
        status="saved"
        dirty={true}
        offline={false}
        onOpenDetails={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /unsaved changes/i }),
    ).toBeTruthy();
  });

  it("offline takes precedence over the save status", () => {
    render(
      <SyncStatus
        providerName="Dropbox"
        status="saved"
        dirty={true}
        offline={true}
        onOpenDetails={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /offline/i })).toBeTruthy();
  });

  it("marks the in-flight save busy", () => {
    render(
      <SyncStatus
        providerName="Dropbox"
        status="saving"
        dirty={false}
        offline={false}
        onOpenDetails={vi.fn()}
      />,
    );
    const btn = screen.getByRole("button");
    expect(btn.getAttribute("aria-busy")).toBe("true");
  });

  it("opens the details on tap", () => {
    const onOpenDetails = vi.fn();
    render(
      <SyncStatus
        providerName="Dropbox"
        status="error"
        dirty={false}
        offline={false}
        onOpenDetails={onOpenDetails}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onOpenDetails).toHaveBeenCalledOnce();
  });

  it("threads injected labels through", () => {
    render(
      <SyncStatus
        providerName="Moln"
        status="idle"
        dirty={false}
        offline={false}
        onOpenDetails={vi.fn()}
        labels={{ syncedTo: (name) => `Synkad till ${name}` }}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Synkad till Moln" }),
    ).toBeTruthy();
  });
});

function renderModal(
  overrides: Partial<Parameters<typeof SyncDetailsModal>[0]> = {},
) {
  const props = {
    open: true,
    providerName: "Dropbox",
    location: { path: "Apps/Demo/default", url: "https://dropbox.com" },
    status: "idle" as SaveStatus,
    dirty: false,
    offline: false,
    onClose: vi.fn(),
    ...overrides,
  };
  render(<SyncDetailsModal {...props} />);
  return props;
}

describe("SyncDetailsModal", () => {
  it("shows the file location and an Open-in link", () => {
    renderModal();
    expect(screen.getByText("Apps/Demo/default")).toBeTruthy();
    const link = screen.getByRole("link", { name: /open in dropbox/i });
    expect(link.getAttribute("href")).toBe("https://dropbox.com");
  });

  it("omits the Open-in link when there is no URL", () => {
    renderModal({ location: { path: "My folder", url: null } });
    expect(screen.queryByRole("link", { name: /open in/i })).toBeNull();
  });

  it("shows encryption On when encrypted", () => {
    renderModal({ encrypted: true });
    expect(screen.getByText("On")).toBeTruthy();
  });

  it("offers Save now when dirty, and fires it", () => {
    const onSaveNow = vi.fn();
    renderModal({ dirty: true, onSaveNow });
    const btn = screen.getByRole("button", { name: "Save now" });
    fireEvent.click(btn);
    expect(onSaveNow).toHaveBeenCalledOnce();
  });

  it("hides Save now when no handler is given", () => {
    renderModal({ dirty: true });
    expect(screen.queryByRole("button", { name: "Save now" })).toBeNull();
  });

  it("shows Reconnect only on an auth error with a handler", () => {
    const onReconnect = vi.fn(() => Promise.resolve());
    renderModal({ status: "auth-error", onReconnect });
    expect(
      screen.getByRole("button", { name: /reconnect dropbox/i }),
    ).toBeTruthy();
  });

  it("reports the probe result while offline", async () => {
    const onCheckConnection = vi.fn(
      (): Promise<ConnectionProbeResult> => Promise.resolve("offline"),
    );
    renderModal({ offline: true, onCheckConnection });
    fireEvent.click(screen.getByRole("button", { name: "Check connection" }));
    await waitFor(() => {
      expect(screen.getByText(/still can't reach dropbox/i)).toBeTruthy();
    });
  });

  it("renders the collapsible log only when a panel is given", () => {
    const { rerender } = render(
      <SyncDetailsModal
        open
        providerName="Dropbox"
        location={{ path: "x" }}
        status="idle"
        dirty={false}
        offline={false}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByText("View sync log")).toBeNull();
    rerender(
      <SyncDetailsModal
        open
        providerName="Dropbox"
        location={{ path: "x" }}
        status="idle"
        dirty={false}
        offline={false}
        onClose={vi.fn()}
        logPanel={<div>my log</div>}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "View sync log" }));
    expect(screen.getByText("my log")).toBeTruthy();
  });
});
