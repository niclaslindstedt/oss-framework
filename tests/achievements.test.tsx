// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AchievementsModal,
  AchievementUnlockModal,
  TrophyButton,
  deriveUnlocks,
  drain,
  resetBus,
  subscribe,
  unlock,
  useAchievementWatcher,
  type Achievement,
} from "../src/achievements/index.ts";

// A tiny demo state + catalog for the engine tests.
type TestState = { count: number; flag: boolean };

const Dot = ({ className }: { className?: string }) => (
  <span className={className} />
);

const catalog: readonly Achievement<TestState>[] = [
  {
    id: "firstItem",
    tier: "beginner",
    glyph: Dot,
    name: "First item",
    condition: "Add one.",
    learnMore: "The very first thing.",
    trigger: {
      kind: "derived",
      slices: (s) => [s.count],
      predicate: (prev, next) => prev.count === 0 && next.count > 0,
    },
  },
  {
    id: "flagOn",
    tier: "intermediate",
    glyph: Dot,
    name: "Flag on",
    condition: "Turn the flag on.",
    trigger: {
      kind: "derived",
      slices: (s) => [s.flag],
      predicate: (prev, next) => !prev.flag && next.flag,
    },
  },
  {
    id: "connected",
    tier: "pro",
    glyph: Dot,
    name: "Connected",
    condition: "Connect something.",
    trigger: { kind: "manual" },
  },
];

afterEach(() => {
  resetBus();
  vi.restoreAllMocks();
});

describe("deriveUnlocks", () => {
  it("returns ids whose predicate flipped false→true", () => {
    const fresh = deriveUnlocks(
      catalog,
      { count: 0, flag: false },
      { count: 1, flag: false },
      {},
    );
    expect(fresh).toEqual(["firstItem"]);
  });

  it("skips ids already unlocked", () => {
    const fresh = deriveUnlocks(
      catalog,
      { count: 0, flag: false },
      { count: 1, flag: false },
      { firstItem: 123 },
    );
    expect(fresh).toEqual([]);
  });

  it("skips manual triggers entirely", () => {
    const fresh = deriveUnlocks(
      catalog,
      { count: 0, flag: false },
      { count: 5, flag: true },
      {},
    );
    expect(fresh).toEqual(["firstItem", "flagOn"]);
    expect(fresh).not.toContain("connected");
  });

  it("does not fire when the predicate is already true in prev", () => {
    const fresh = deriveUnlocks(
      catalog,
      { count: 2, flag: false },
      { count: 3, flag: false },
      {},
    );
    expect(fresh).toEqual([]);
  });
});

describe("bus", () => {
  it("queues unique ids and drains them once", () => {
    unlock("connected");
    unlock("connected");
    expect(drain()).toEqual(["connected"]);
    expect(drain()).toEqual([]);
  });

  it("notifies subscribers and stops after unsubscribe", () => {
    const listener = vi.fn();
    const off = subscribe(listener);
    unlock("connected");
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    drain();
    unlock("again");
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("useAchievementWatcher", () => {
  type P = Parameters<typeof useAchievementWatcher<TestState>>[0];

  it("does not backfill on the load transition, then fires on real deltas", () => {
    const record = vi.fn((ids: readonly string[]) => [...ids]);
    const onUnlocked = vi.fn();
    const { rerender } = renderHook((p: P) => useAchievementWatcher(p), {
      initialProps: {
        catalog,
        state: { count: 0, flag: false },
        unlocked: {},
        loaded: false,
        record,
        onUnlocked,
      } as P,
    });
    // Backend resolves with a hydrated doc that already satisfies a predicate:
    // the first loaded render only baselines, so nothing fires.
    rerender({
      catalog,
      state: { count: 3, flag: false },
      unlocked: {},
      loaded: true,
      record,
      onUnlocked,
    });
    expect(record).not.toHaveBeenCalled();

    // A genuine delta after load fires.
    rerender({
      catalog,
      state: { count: 3, flag: true },
      unlocked: {},
      loaded: true,
      record,
      onUnlocked,
    });
    expect(record).toHaveBeenCalledWith(["flagOn"]);
    expect(onUnlocked).toHaveBeenCalledWith(["flagOn"]);
  });

  it("drains the manual bus once loaded", () => {
    const record = vi.fn((ids: readonly string[]) => [...ids]);
    renderHook((p: P) => useAchievementWatcher(p), {
      initialProps: {
        catalog,
        state: { count: 1, flag: false },
        unlocked: {},
        loaded: true,
        record,
        onUnlocked: vi.fn(),
      } as P,
    });
    unlock("connected");
    expect(record).toHaveBeenCalledWith(["connected"]);
  });

  it("no-ops while disabled and discards queued manual unlocks", () => {
    const record = vi.fn((ids: readonly string[]) => [...ids]);
    const { rerender } = renderHook((p: P) => useAchievementWatcher(p), {
      initialProps: {
        catalog,
        state: { count: 0, flag: false },
        unlocked: {},
        loaded: true,
        enabled: false,
        record,
        onUnlocked: vi.fn(),
      } as P,
    });
    unlock("connected");
    rerender({
      catalog,
      state: { count: 1, flag: false },
      unlocked: {},
      loaded: true,
      enabled: false,
      record,
      onUnlocked: vi.fn(),
    });
    expect(record).not.toHaveBeenCalled();
    // The queued manual id was drained-and-discarded, not held.
    expect(drain()).toEqual([]);
  });
});

describe("AchievementsModal", () => {
  it("renders unlocked entries and the running counter", () => {
    render(
      <AchievementsModal
        open
        onClose={() => {}}
        achievements={catalog}
        unlocked={{ firstItem: 1 }}
      />,
    );
    expect(screen.getByText("First item")).toBeTruthy();
    // 1 of 3 unlocked, 10 of (10+25+50) pts.
    expect(screen.getByText(/1 of 3 unlocked/)).toBeTruthy();
    expect(screen.getByText(/10 \/ 85 pts/)).toBeTruthy();
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <AchievementsModal
        open={false}
        onClose={() => {}}
        achievements={catalog}
        unlocked={{}}
      />,
    );
    expect(container.querySelector("[aria-modal]")).toBeNull();
  });
});

describe("AchievementUnlockModal", () => {
  it("lists only the unseen ids", () => {
    render(
      <AchievementUnlockModal
        open
        onClose={() => {}}
        achievements={catalog}
        unseenIds={["flagOn"]}
      />,
    );
    expect(screen.getByText("Flag on")).toBeTruthy();
    expect(screen.queryByText("First item")).toBeNull();
  });

  it("renders nothing with an empty queue", () => {
    const { container } = render(
      <AchievementUnlockModal
        open
        onClose={() => {}}
        achievements={catalog}
        unseenIds={[]}
      />,
    );
    expect(container.querySelector("[aria-modal]")).toBeNull();
  });
});

describe("TrophyButton", () => {
  it("is quiet with no unseen unlocks and lit with a badge otherwise", () => {
    const { rerender } = render(
      <TrophyButton unseenCount={0} onClick={() => {}} />,
    );
    expect(screen.getByRole("button").getAttribute("aria-label")).toBe(
      "Achievements",
    );

    rerender(<TrophyButton unseenCount={2} onClick={() => {}} />);
    expect(screen.getByRole("button").getAttribute("aria-label")).toBe(
      "2 new achievements",
    );
    expect(screen.getByText("2")).toBeTruthy();
  });
});
