// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useMeasuredSize } from "../src/hooks/index.ts";
import {
  BarChart,
  DonutChart,
  LineChart,
  Sparkline,
} from "../src/charts/index.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

// --- Sparkline -----------------------------------------------------------

describe("Sparkline", () => {
  it("is decorative (aria-hidden) unless labelled", () => {
    const { container } = render(<Sparkline values={[1, 2, 3]} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("role")).toBeNull();
  });

  it("becomes an image when labelled", () => {
    render(<Sparkline values={[1, 2, 3]} ariaLabel="Trend" />);
    expect(screen.getByRole("img", { name: "Trend" })).toBeTruthy();
  });

  it("draws one path and an optional last-value dot", () => {
    const { container } = render(
      <Sparkline values={[1, null, 3]} showLastDot />,
    );
    const path = container.querySelector("path");
    // The gap splits the stroke into two subpaths.
    expect(path?.getAttribute("d")?.match(/M/g)).toHaveLength(2);
    expect(container.querySelector("circle")).toBeTruthy();
  });

  it("renders nothing pathological for an empty series", () => {
    const { container } = render(<Sparkline values={[]} />);
    expect(container.querySelector("path")).toBeNull();
  });
});

// --- LineChart -----------------------------------------------------------

describe("LineChart", () => {
  const series = [
    { values: [1, 2, 3], label: "Alpha" },
    { values: [3, 2, 1], label: "Beta" },
  ];

  it("renders as a labelled image with one stroke per series", () => {
    const { container } = render(
      <LineChart
        width={300}
        series={series}
        x={{ labels: ["a", "b", "c"] }}
        ariaLabel="Two series"
        desc="Alpha rises while Beta falls"
      />,
    );
    expect(screen.getByRole("img", { name: "Two series" })).toBeTruthy();
    expect(container.querySelector("desc")?.textContent).toBe(
      "Alpha rises while Beta falls",
    );
    const strokes = Array.from(
      container.querySelectorAll('path[fill="none"]'),
    ).map((p) => p.getAttribute("stroke"));
    expect(strokes).toEqual(["var(--accent)", "var(--link)"]);
  });

  it("legends every labelled series when there are two or more", () => {
    render(
      <LineChart
        width={300}
        series={series}
        x={{ labels: ["a", "b", "c"] }}
        ariaLabel="Two series"
      />,
    );
    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(screen.getByText("Beta")).toBeTruthy();
  });

  it("shows no legend for a single series", () => {
    render(
      <LineChart
        width={300}
        series={[{ values: [1, 2], label: "Only" }]}
        x={{ labels: ["a", "b"] }}
        ariaLabel="One series"
      />,
    );
    expect(screen.queryByText("Only")).toBeNull();
  });

  it("breaks lines at null gaps and surfaces stranded points as dots", () => {
    const { container } = render(
      <LineChart
        width={300}
        series={[{ values: [1, 2, null, 4, null] }]}
        ariaLabel="Gappy"
      />,
    );
    const stroke = container.querySelector('path[fill="none"]');
    expect(stroke?.getAttribute("d")?.match(/M/g)).toHaveLength(2);
    // Index 3 is stranded between gaps → rendered as a dot.
    expect(container.querySelectorAll("circle")).toHaveLength(1);
  });

  it("renders calendar tick labels for a timestamps axis", () => {
    const days = Array.from(
      { length: 14 },
      (_, i) => new Date(2026, 5, 20 + i),
    );
    const { container } = render(
      <LineChart
        width={400}
        series={[{ values: days.map((_, i) => i) }]}
        x={{ timestamps: days }}
        ariaLabel="Two weeks"
      />,
    );
    const texts = Array.from(container.querySelectorAll("text")).map(
      (t) => t.textContent,
    );
    // Week ticks land on Mondays: Jun 22 & 29 2026 (locale-formatted).
    expect(texts.some((t) => t?.includes("22"))).toBe(true);
    expect(texts.some((t) => t?.includes("29"))).toBe(true);
  });

  it("stacks series as filled areas when asked", () => {
    const { container } = render(
      <LineChart
        width={300}
        series={series}
        stacked
        x={{ labels: ["a", "b", "c"] }}
        ariaLabel="Stacked"
      />,
    );
    // Each layer is a fill + a top edge.
    expect(container.querySelectorAll('path[fill-opacity="0.3"]')).toHaveLength(
      2,
    );
    expect(container.querySelectorAll('path[fill="none"]')).toHaveLength(2);
  });
});

// --- BarChart --------------------------------------------------------------

describe("BarChart", () => {
  it("renders one titled bar per value", () => {
    const { container } = render(
      <BarChart
        width={300}
        series={[{ values: [3, 1] }]}
        labels={["Mon", "Tue"]}
        ariaLabel="Two bars"
      />,
    );
    expect(screen.getByRole("img", { name: "Two bars" })).toBeTruthy();
    const titles = Array.from(container.querySelectorAll("path > title")).map(
      (t) => t.textContent,
    );
    expect(titles).toEqual(["Mon: 3", "Tue: 1"]);
  });

  it("prefixes tooltips with the series label when grouped", () => {
    const { container } = render(
      <BarChart
        width={300}
        series={[
          { values: [1], label: "A" },
          { values: [2], label: "B" },
        ]}
        labels={["x"]}
        ariaLabel="Grouped"
      />,
    );
    const titles = Array.from(container.querySelectorAll("path > title")).map(
      (t) => t.textContent,
    );
    expect(titles).toEqual(["A · x: 1", "B · x: 2"]);
  });

  it("stacks segments and skips zero-length ones", () => {
    const { container } = render(
      <BarChart
        width={300}
        series={[
          { values: [2, 0], label: "A" },
          { values: [1, 4], label: "B" },
        ]}
        labels={["x", "y"]}
        stacked
        ariaLabel="Stacked"
      />,
    );
    // Column x: two segments; column y: only B (A is zero).
    expect(container.querySelectorAll("path > title")).toHaveLength(3);
  });

  it("renders horizontally with category names in the gutter", () => {
    const { container } = render(
      <BarChart
        width={300}
        series={[{ values: [5, 2] }]}
        labels={["First", "Second"]}
        horizontal
        ariaLabel="Rows"
      />,
    );
    const texts = Array.from(container.querySelectorAll("text")).map(
      (t) => t.textContent,
    );
    expect(texts).toContain("First");
    expect(texts).toContain("Second");
  });

  it("keeps the baseline honest for negative values", () => {
    const { container } = render(
      <BarChart
        width={300}
        series={[{ values: [3, -2] }]}
        labels={["up", "down"]}
        ariaLabel="Signed"
      />,
    );
    expect(container.querySelectorAll("path > title")).toHaveLength(2);
  });
});

// --- DonutChart ------------------------------------------------------------

describe("DonutChart", () => {
  it("renders labelled segments, a legend, and the inner label", () => {
    const { container } = render(
      <DonutChart
        segments={[
          { value: 3, label: "Done" },
          { value: 1, label: "Open" },
        ]}
        innerLabel={<strong>75%</strong>}
        ariaLabel="Completion"
      />,
    );
    expect(screen.getByRole("img", { name: "Completion" })).toBeTruthy();
    expect(screen.getByText("Done")).toBeTruthy();
    expect(screen.getByText("Open")).toBeTruthy();
    expect(screen.getByText("75%")).toBeTruthy();
    const titles = Array.from(container.querySelectorAll("path > title")).map(
      (t) => t.textContent,
    );
    expect(titles).toEqual(["Done: 3 (75%)", "Open: 1 (25%)"]);
  });

  it("separates segments with a surface-coloured stroke", () => {
    const { container } = render(
      <DonutChart segments={[{ value: 1 }, { value: 1 }]} ariaLabel="Halves" />,
    );
    for (const path of container.querySelectorAll("path")) {
      expect(path.getAttribute("stroke")).toBe("var(--surface)");
      expect(path.getAttribute("stroke-width")).toBe("2");
    }
  });
});

// --- useMeasuredSize ---------------------------------------------------------

function Probe() {
  const { ref, size } = useMeasuredSize<HTMLDivElement>();
  return (
    <div ref={ref} data-testid="probe">
      {size ? `${size.width}x${size.height}` : "unmeasured"}
    </div>
  );
}

describe("useMeasuredSize", () => {
  it("observes the element and reports rounded sizes", () => {
    const instances: {
      callback: ResizeObserverCallback;
      observed: Element[];
    }[] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        callback: ResizeObserverCallback;
        observed: Element[] = [];
        constructor(callback: ResizeObserverCallback) {
          this.callback = callback;
          instances.push(this as unknown as (typeof instances)[number]);
        }
        observe(el: Element) {
          this.observed.push(el);
        }
        disconnect() {}
      },
    );
    render(<Probe />);
    expect(instances).toHaveLength(1);
    expect(instances[0]!.observed).toHaveLength(1);
    act(() => {
      instances[0]!.callback(
        [
          {
            contentRect: { width: 320.4, height: 100.6 },
          } as ResizeObserverEntry,
        ],
        instances[0] as unknown as ResizeObserver,
      );
    });
    expect(screen.getByTestId("probe").textContent).toBe("320x101");
  });

  it("falls back to a one-shot measurement without ResizeObserver", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    render(<Probe />);
    // jsdom rects are all-zero; the point is it measured instead of throwing.
    expect(screen.getByTestId("probe").textContent).toBe("0x0");
  });
});
