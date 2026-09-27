// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import { auditReferences, findCitations } from "../src/references/audit.ts";
import {
  byline,
  byTopic,
  CITATION_TAG,
  EVIDENCE,
  evidenceRank,
  publication,
  referenceList,
  referenceSummary,
  sourceLink,
  unlistedTopics,
  type Registry,
} from "../src/references/registry.ts";

type Topic = "sleep" | "growth" | "food";
const TOPICS = ["sleep", "growth", "food"] as const;

const registry: Registry<Topic> = {
  references: {
    "fohm-2026-somnvanor": {
      evidence: "health-service",
      organization: "Folkhälsomyndigheten",
      title: "Sömnvanor hos barn",
      container: "Folkhälsomyndigheten (art.nr 26026)",
      year: 2026,
      url: "https://www.folkhalsomyndigheten.se/somnvanor",
      language: "sv",
      accessed: "2026-09-27",
      quotes: [{ text: "Barn behöver sova." }],
      supports: "The Swedish framing of the sleep recommendation.",
      summary: {
        en: "How much sleep children need.",
        sv: "Hur mycket barn sover.",
      },
      topics: ["sleep"],
      usedBy: ["src/sleep.ts"],
    },
    "galland-2012": {
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
    },
    "paruthi-2016": {
      evidence: "consensus",
      authors: ["Paruthi S", "Brooks LJ", "D'Ambrosio C"],
      title: "Recommended amount of sleep for pediatric populations",
      container: "Journal of Clinical Sleep Medicine",
      year: 2016,
      volume: "12",
      doi: "10.5664/jcsm.5866",
      quotes: [{ text: "12 to 16 hours per 24 hours" }],
      supports: "The AASM's hours.",
      summary: { en: "The AASM's hours.", sv: "AASM:s timmar." },
      topics: ["sleep", "growth"],
      usedBy: ["src/sleep.ts", "src/growth.ts"],
    },
    "hirshkowitz-2015": {
      evidence: "consensus",
      authors: ["Hirshkowitz M"],
      title: "National Sleep Foundation's sleep time duration recommendations",
      container: "Sleep Health",
      year: 2015,
      pages: "40–43",
      doi: "10.1016/j.sleh.2014.12.010",
      quotes: [{ text: "14 to 17 hours" }],
      supports: "The NSF's hours.",
      summary: { en: "The NSF's hours.", sv: "NSF:s timmar." },
      topics: ["sleep"],
      usedBy: ["src/sleep.ts"],
    },
    "nnr-2023": {
      evidence: "guideline",
      organization: "Nordic Council of Ministers",
      title: "Nordic Nutrition Recommendations 2023",
      year: 2023,
      isbn: "978-92-893-7563-2",
      quotes: [{ text: "Energy intake…" }],
      supports: "The energy target.",
      summary: { en: "How much energy.", sv: "Hur mycket energi." },
      topics: ["food"],
      usedBy: ["src/nutrition.ts"],
    },
  },
};

const sources: Record<string, string> = {
  "src/sleep.ts":
    "// 12–16 h [ref:paruthi-2016] [ref:hirshkowitz-2015]\n" +
    "// [ref:galland-2012] and [ref:fohm-2026-somnvanor]\n" +
    "// cited twice [ref:galland-2012]",
  "src/growth.ts": "/** z-scores [ref:paruthi-2016] */",
  "src/nutrition.ts": "const KCAL = 80; // [ref:nnr-2023]",
  "src/plain.ts": "// no tags here, and [ref:Not-An-Id] is not one",
};

describe("the evidence vocabulary", () => {
  it("is OSS_SPEC §24.2's, strongest first", () => {
    expect(EVIDENCE[0]).toBe("guideline");
    expect(EVIDENCE.at(-1)).toBe("health-service");
    expect(EVIDENCE).toHaveLength(11);
  });

  it("ranks an unknown kind after every known one", () => {
    expect(evidenceRank("guideline")).toBe(0);
    expect(evidenceRank("anecdote")).toBe(EVIDENCE.length);
  });
});

describe("referenceList", () => {
  const list = referenceList(registry);

  it("lists every entry once, with its id, strongest evidence first", () => {
    expect(list.map((r) => r.id).sort()).toEqual(
      Object.keys(registry.references).sort(),
    );
    expect(list[0]!.id).toBe("nnr-2023");
    expect(list.at(-1)!.id).toBe("fohm-2026-somnvanor");
    const ranks = list.map((r) => evidenceRank(r.evidence));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it("ranks within a kind by who published it, then when", () => {
    expect(
      list.filter((r) => r.evidence === "consensus").map((r) => r.id),
    ).toEqual(["hirshkowitz-2015", "paruthi-2016"]);
  });
});

describe("grouping by topic", () => {
  const list = referenceList(registry);

  it("groups in the order given, listing a two-topic source under both", () => {
    const groups = byTopic(list, TOPICS);
    expect(groups.map((g) => g.topic)).toEqual(["sleep", "growth", "food"]);
    expect(groups[1]!.refs.map((r) => r.id)).toEqual(["paruthi-2016"]);
    expect(groups[0]!.refs).toHaveLength(4);
  });

  it("leaves out, and names, the topics nothing is listed under", () => {
    const sleepOnly = list.filter((r) => r.id !== "nnr-2023");
    expect(byTopic(sleepOnly, TOPICS).map((g) => g.topic)).toEqual([
      "sleep",
      "growth",
    ]);
    expect(unlistedTopics(sleepOnly, TOPICS)).toEqual(["food"]);
  });

  it("treats an entry without topics as listed under none", () => {
    const [first] = list;
    const bare = { ...first!, topics: undefined };
    expect(byTopic([bare], TOPICS)).toEqual([]);
  });
});

describe("citing an entry", () => {
  const list = referenceList(registry);
  const find = (id: string) => list.find((r) => r.id === id)!;

  it("cites a paper by its authors and journal, and links its DOI", () => {
    const galland = find("galland-2012");
    expect(byline(galland)).toBe("Galland BC et al.");
    expect(publication(galland)).toBe("Sleep Medicine Reviews 16(3):213–222");
    expect(sourceLink(galland)).toBe(
      "https://doi.org/10.1016/j.smrv.2011.06.001",
    );
  });

  it("lists up to three authors in full", () => {
    expect(byline(find("paruthi-2016"))).toBe(
      "Paruthi S, Brooks LJ, D'Ambrosio C",
    );
  });

  it("writes pages without a volume after a comma", () => {
    expect(publication(find("hirshkowitz-2015"))).toBe("Sleep Health, 40–43");
    expect(publication(find("paruthi-2016"))).toBe(
      "Journal of Clinical Sleep Medicine 12",
    );
  });

  it("cites a health service by its organization, and links its page", () => {
    const fohm = find("fohm-2026-somnvanor");
    expect(byline(fohm)).toBe("Folkhälsomyndigheten");
    expect(publication(fohm)).toBe("Folkhälsomyndigheten (art.nr 26026)");
    expect(sourceLink(fohm)).toBe(fohm.url);
  });

  it("has no link for a book, which is found by its ISBN", () => {
    const nnr = find("nnr-2023");
    expect(sourceLink(nnr)).toBeNull();
    expect(publication(nnr)).toBe("");
  });

  it("picks the summary in the language asked for, then the fallbacks, then supports", () => {
    const galland = find("galland-2012");
    expect(referenceSummary(galland, "sv")).toBe("Vad barn sover.");
    expect(referenceSummary(galland, "de", ["en"])).toBe(
      "What children sleep.",
    );
    expect(referenceSummary(galland, "de")).toBe(galland.supports);
    expect(referenceSummary({ ...galland, summary: undefined }, "en")).toBe(
      galland.supports,
    );
  });
});

describe("findCitations", () => {
  it("maps each tagged id to the files that tag it, once each, sorted", () => {
    const cited = findCitations(sources);
    expect(cited.get("paruthi-2016")).toEqual([
      "src/growth.ts",
      "src/sleep.ts",
    ]);
    expect(cited.get("galland-2012")).toEqual(["src/sleep.ts"]);
    expect(cited.has("Not-An-Id")).toBe(false);
    expect([...cited.keys()].sort()).toEqual(
      Object.keys(registry.references).sort(),
    );
  });

  it("leaves the shared tag pattern reusable", () => {
    findCitations(sources);
    expect([..."[ref:a-b]".matchAll(CITATION_TAG)]).toHaveLength(1);
  });
});

describe("auditReferences", () => {
  const options = { languages: ["en", "sv"], topics: TOPICS };

  it("finds nothing wrong with a registry in step with its code", () => {
    expect(auditReferences(registry, sources, options)).toEqual([]);
  });

  it("names a tag with no entry, and where it is", () => {
    const problems = auditReferences(registry, {
      ...sources,
      "src/extra.ts": "// [ref:who-2006]",
    });
    expect(problems).toEqual([
      {
        rule: "unresolved",
        id: "who-2006",
        message: "[ref:who-2006] in src/extra.ts names no entry",
      },
    ]);
  });

  it("names an entry nothing cites", () => {
    const problems = auditReferences(registry, {
      ...sources,
      "src/nutrition.ts": "// the tag was dropped",
    });
    expect(problems.map((p) => [p.rule, p.id])).toEqual([
      ["uncited", "nnr-2023"],
    ]);
  });

  it("holds usedBy to exactly the citing files", () => {
    const problems = auditReferences(registry, {
      ...sources,
      "src/growth.ts": "// nothing",
      "src/diapers.ts": "// [ref:galland-2012]",
    });
    expect(problems.map((p) => [p.rule, p.id])).toEqual([
      ["used-by", "galland-2012"],
      ["used-by", "paruthi-2016"],
    ]);
    expect(problems[0]!.message).toBe(
      "galland-2012: usedBy is [src/sleep.ts], the tags are in [src/diapers.ts, src/sleep.ts]",
    );
  });

  it("names each missing or ill-formed field of an entry", () => {
    const broken: Registry = {
      references: {
        Bad_Id: {
          evidence: "anecdote" as never,
          title: " ",
          year: 2012.5,
          doi: "https://doi.org/10.1/x",
          url: "http://example.com",
          accessed: "27/09/2026",
          language: "english please",
          quotes: [{ text: "" }],
          supports: "",
          usedBy: ["src/x.ts"],
        },
        "no-way-back": {
          evidence: "review",
          authors: [],
          title: "A title",
          year: 2020,
          quotes: [],
          supports: "Something.",
          usedBy: ["src/x.ts"],
        },
      },
    };
    const problems = auditReferences(broken, {
      "src/x.ts": "// [ref:no-way-back]",
    });
    expect(problems.filter((p) => p.rule === "incomplete")).toEqual(
      [
        "Bad_Id: the id is not kebab-case",
        "Bad_Id: no title",
        "Bad_Id: the year is not an integer",
        "Bad_Id: no authors or organization",
        'Bad_Id: the doi "https://doi.org/10.1/x" is not a bare 10.xxxx/… DOI',
        'Bad_Id: the url "http://example.com" is not https://',
        'Bad_Id: accessed "27/09/2026" is not YYYY-MM-DD',
        'Bad_Id: the language "english please" is not a BCP 47 tag',
        'Bad_Id: the evidence "anecdote" is not in the vocabulary',
        "Bad_Id: a quote with no text",
        "Bad_Id: no supports",
        "no-way-back: no authors or organization",
        "no-way-back: no doi, url or isbn to find it by",
        "no-way-back: no quotes",
      ].map((message) => ({
        rule: "incomplete",
        id: message.split(":")[0],
        message,
      })),
    );
    // The id no file could cite is also uncited.
    expect(problems).toContainEqual({
      rule: "uncited",
      id: "Bad_Id",
      message: "Bad_Id: no file cites it",
    });
  });

  it("holds summary and topics to their shape whenever they are present", () => {
    const odd: Registry<string> = {
      references: {
        "galland-2012": {
          ...registry.references["galland-2012"]!,
          summary: { en: " ", english: "What children sleep." },
          topics: ["Sleep", "night-waking"],
        },
        "paruthi-2016": {
          ...registry.references["paruthi-2016"]!,
          summary: "What children sleep." as never,
          topics: [],
        },
        "fohm-2026-somnvanor": {
          ...registry.references["fohm-2026-somnvanor"]!,
          summary: {},
          topics: "sleep" as never,
        },
      },
    };
    const code = {
      "src/sleep.ts":
        "// [ref:galland-2012] [ref:paruthi-2016] [ref:fohm-2026-somnvanor]",
      "src/growth.ts": "// [ref:paruthi-2016]",
    };
    expect(auditReferences(odd, code).map((p) => [p.rule, p.message])).toEqual([
      ["summary", 'galland-2012: the summary in "en" is empty'],
      [
        "summary",
        'galland-2012: the summary key "english" is not a BCP 47 tag',
      ],
      ["topics", 'galland-2012: the topic "Sleep" is not kebab-case'],
      ["summary", "paruthi-2016: the summary is not keyed by language"],
      ["topics", "paruthi-2016: the topics list is empty"],
      ["summary", "fohm-2026-somnvanor: the summary has no language"],
      ["topics", "fohm-2026-somnvanor: the topics are not a list"],
    ]);
    // With the app's languages given, a blank line is named once, not twice.
    expect(
      auditReferences(odd, code, { languages: ["en"] })
        .filter((p) => p.id === "galland-2012" && p.rule === "summary")
        .map((p) => p.message),
    ).toEqual([
      'galland-2012: the summary in "en" is empty',
      'galland-2012: the summary key "english" is not a BCP 47 tag',
    ]);
  });

  it("checks the app's own vocabulary only when asked", () => {
    const thin: Registry<string> = {
      references: {
        "galland-2012": {
          ...registry.references["galland-2012"]!,
          summary: { en: "What children sleep." },
          topics: ["sleep", "bedtime"],
        },
        "paruthi-2016": {
          ...registry.references["paruthi-2016"]!,
          topics: undefined,
        },
      },
    };
    const code = {
      "src/sleep.ts": "// [ref:galland-2012] [ref:paruthi-2016]",
      "src/growth.ts": "// [ref:paruthi-2016]",
    };
    expect(auditReferences(thin, code)).toEqual([]);
    expect(auditReferences(thin, code, options).map((p) => p.message)).toEqual([
      'galland-2012: no summary in "sv"',
      'galland-2012: unknown topic "bedtime"',
      "paruthi-2016: no topics",
    ]);
  });
});
