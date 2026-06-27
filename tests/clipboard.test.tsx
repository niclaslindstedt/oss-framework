// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CopyButton } from "../src/components/index.ts";
import { copyTextToClipboard } from "../src/hooks/index.ts";

// Each test installs its own clipboard stub; restore the real timers/mocks after.
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function stubClipboard(writeText: (t: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
}

// jsdom doesn't implement execCommand, so assign a stub rather than spy on a
// missing property. Returns the mock so a test can assert on it.
function stubExecCommand(result: boolean) {
  const exec = vi.fn().mockReturnValue(result);
  (document as unknown as { execCommand: typeof exec }).execCommand = exec;
  return exec;
}

describe("copyTextToClipboard", () => {
  it("writes through the async Clipboard API and reports success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);

    await expect(copyTextToClipboard("hello")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("falls back to execCommand when the Clipboard API throws", async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error("blocked")));
    const exec = stubExecCommand(true);

    await expect(copyTextToClipboard("legacy")).resolves.toBe(true);
    expect(exec).toHaveBeenCalledWith("copy");
  });

  it("reports failure when every path fails", async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error("blocked")));
    stubExecCommand(false);

    await expect(copyTextToClipboard("nope")).resolves.toBe(false);
  });
});

describe("CopyButton", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("copies the value, flashes the copied label, then reverts", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    const onCopied = vi.fn();

    render(
      <CopyButton
        value="payload"
        labels={{ copy: "Copy list", copied: "Copied!" }}
        resetDelay={1000}
        onCopied={onCopied}
      />,
    );

    const button = screen.getByRole("button", { name: "Copy list" });
    await act(async () => {
      fireEvent.click(button);
    });

    expect(writeText).toHaveBeenCalledWith("payload");
    expect(onCopied).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Copied!" })).toBeTruthy();

    // After the reset delay the idle label returns.
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole("button", { name: "Copy list" })).toBeTruthy();
  });

  it("resolves an async getter at click time", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    const getValue = vi.fn().mockResolvedValue("fresh");

    render(<CopyButton value={getValue} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    expect(getValue).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith("fresh");
  });

  it("fires onError and stays idle when the write fails", async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error("blocked")));
    stubExecCommand(false);
    const onError = vi.fn();

    render(
      <CopyButton value="x" labels={{ copy: "Copy" }} onError={onError} />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
  });
});
