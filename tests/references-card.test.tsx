// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ReferenceCard } from "../src/references/ReferenceCard.tsx";
import type { Reference, Registry } from "../src/references/registry.ts";
import {
  loadReferences,
  useReferences,
} from "../src/references/useReferences.ts";

const paper: Reference = {
  id: "galland-2012",
  evidence: "systematic-review",
  authors: ["Galland BC", "Taylor BJ", "Elder DE", "Herbison P"],
  title: "Normal sleep patterns in infants and children",
  container: "Sleep Medicine Reviews",
  year: 2012,
  volume: "16",
  issue: "3",
  pages: "213–222",
  doi: "10.1016/j.smrv.2011.06.001",
  language: "en",
  quotes: [{ text: "≈6 months 12.9 (8.8–17.0)", at: "table 2" }],
  supports: "The observed range of total sleep at each age.",
  summary: { en: "What children sleep.", sv: "Vad barn sover." },
  topics: ["sleep"],
  usedBy: ["src/sleep.ts"],
};

const page: Reference = {
  id: "fohm-2026",
  evidence: "health-service",
  organization: "Folkhälsomyndigheten",
  title: "Sömnvanor hos barn",
  year: 2026,
  url: "https://www.folkhalsomyndigheten.se/somnvanor",
  language: "sv",
  accessed: "2026-09-27",
  quotes: [{ text: "Barn behöver sova." }],
  supports: "The Swedish framing.",
  usedBy: ["src/sleep.ts"],
};

const book: Reference = {
  id: "nnr-2023",
  evidence: "guideline",
  organization: "Nordic Council of Ministers",
  title: "Nordic Nutrition Recommendations 2023",
  year: 2023,
  isbn: "978-92-893-7563-2",
  quotes: [{ text: "Energy intake…" }],
  supports: "The energy target.",
  usedBy: ["src/nutrition.ts"],
};

describe("ReferenceCard", () => {
  it("cites a paper: evidence, year, title, byline, journal, summary, DOI", () => {
    render(<ReferenceCard reference={paper} />);
    expect(screen.getByText("Systematic review")).toBeTruthy();
    expect(screen.getByText("2012")).toBeTruthy();
    expect(screen.getByText(paper.title).getAttribute("lang")).toBe("en");
    expect(
      screen.getByText(
        "Galland BC et al. · Sleep Medicine Reviews 16(3):213–222",
      ),
    ).toBeTruthy();
    expect(screen.getByText("What children sleep.")).toBeTruthy();
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe(
      "https://doi.org/10.1016/j.smrv.2011.06.001",
    );
    expect(link.textContent).toBe("doi:10.1016/j.smrv.2011.06.001");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("keeps the quotes behind a disclosure, in the source's language", () => {
    const { container } = render(<ReferenceCard reference={paper} />);
    const details = container.querySelector("details")!;
    expect(details.open).toBe(false);
    expect(details.querySelector("summary")!.textContent).toBe(
      "What the app took from it",
    );
    const quote = details.querySelector("blockquote")!;
    expect(quote.textContent).toBe("“≈6 months 12.9 (8.8–17.0)”");
    expect(quote.getAttribute("lang")).toBe("en");
    expect(screen.getByText("table 2")).toBeTruthy();
  });

  it("takes its words from the caller, and the summary in the caller's language", () => {
    render(
      <ReferenceCard
        reference={page}
        lang="sv"
        locale="sv-SE"
        labels={{
          quotes: "Det appen tog från den",
          openSource: "Öppna källan",
          accessed: (date) => `Läst ${date}`,
          evidence: { "health-service": "Vårdens råd" },
        }}
      />,
    );
    expect(screen.getByText("Vårdens råd")).toBeTruthy();
    expect(screen.getByText("Det appen tog från den")).toBeTruthy();
    expect(screen.getByRole("link").textContent).toBe("Öppna källan");
    expect(screen.getByRole("link").getAttribute("href")).toBe(page.url);
    expect(screen.getByText(/^Läst 27 sep/)).toBeTruthy();
    // No summary: the contributor's line stands in.
    expect(screen.getByText("The Swedish framing.")).toBeTruthy();
  });

  it("names a book by its ISBN when there is nothing to link", () => {
    render(<ReferenceCard reference={book} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("ISBN 978-92-893-7563-2")).toBeTruthy();
    expect(screen.getByText("Nordic Council of Ministers")).toBeTruthy();
  });
});

describe("useReferences", () => {
  const entry = ({ id, ...rest }: Reference) => [id, rest] as const;
  const registry: Registry = {
    references: Object.fromEntries([entry(paper), entry(book)]),
  };

  it("loads once per loader, ranks, and serves later mounts at once", async () => {
    const load = vi.fn(async () => registry);
    const first = renderHook(() => useReferences(load));
    expect(first.result.current).toBeNull();
    await waitFor(() => expect(first.result.current).not.toBeNull());
    expect(first.result.current!.map((r) => r.id)).toEqual([
      "nnr-2023",
      "galland-2012",
    ]);

    const second = renderHook(() => useReferences(load));
    expect(second.result.current).toBe(first.result.current);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("forgets a failed load, so the next one tries again", async () => {
    let fail = true;
    const load = vi.fn(async () => {
      if (fail) throw new Error("chunk missing");
      return registry;
    });
    await expect(loadReferences(load)).rejects.toThrow("chunk missing");
    fail = false;
    await expect(loadReferences(load)).resolves.toHaveLength(2);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
