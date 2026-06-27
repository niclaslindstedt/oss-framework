// @vitest-environment jsdom
import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createI18n, detectBrowserLanguage } from "../src/i18n/index.ts";
import type { I18nConfig, Widen } from "../src/i18n/index.ts";

const en = {
  common: { close: "Close", greet: "Hi {name}" },
  nav: { home: "Home" },
} as const;

const sv = {
  common: { close: "Stäng", greet: "Hej {name}" },
  nav: { home: "Hem" },
} as const;

type Catalog = Widen<typeof en>;
type Lang = "en" | "sv";

function makeI18n(overrides: Partial<I18nConfig<Lang, Catalog>> = {}) {
  return createI18n<Lang, Catalog>({
    fallbackLang: "en",
    fallbackCatalog: en,
    loaders: { sv: () => Promise.resolve(sv) },
    toBcp47: (l) => (l === "sv" ? "sv-SE" : "en-GB"),
    storageKey: "test.language",
    eventName: "test:language",
    ...overrides,
  });
}

afterEach(() => {
  localStorage.clear();
  document.documentElement.lang = "";
  vi.restoreAllMocks();
});

describe("createI18n runtime", () => {
  it("resolves keys against the fallback catalog synchronously", () => {
    const i18n = makeI18n();
    expect(i18n.tFor("en", "common.close")).toBe("Close");
    expect(i18n.tFor("en", "nav.home")).toBe("Home");
  });

  it("interpolates {name}-style params and leaves unknowns verbatim", () => {
    const i18n = makeI18n();
    expect(i18n.tFor("en", "common.greet", { name: "Ada" })).toBe("Hi Ada");
    expect(i18n.tFor("en", "common.greet")).toBe("Hi {name}");
  });

  it("falls back to the fallback catalog until a language is loaded", async () => {
    const i18n = makeI18n();
    // sv not resident yet → English fallback.
    expect(i18n.isCatalogLoaded("sv")).toBe(false);
    expect(i18n.tFor("sv", "common.close")).toBe("Close");
    await i18n.ensureCatalog("sv");
    expect(i18n.isCatalogLoaded("sv")).toBe(true);
    expect(i18n.tFor("sv", "common.close")).toBe("Stäng");
  });

  it("returns the key itself for an unknown path", () => {
    const i18n = makeI18n();
    // @ts-expect-error — exercising a key outside the catalog type.
    expect(i18n.tFor("en", "does.not.exist")).toBe("does.not.exist");
  });

  it("de-dupes concurrent loads of the same language", async () => {
    const loader = vi.fn(() => Promise.resolve(sv));
    const i18n = makeI18n({ loaders: { sv: loader } });
    await Promise.all([i18n.ensureCatalog("sv"), i18n.ensureCatalog("sv")]);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("derives supportedLangs from fallback + loaders when unset", () => {
    const i18n = makeI18n({ supportedLangs: undefined });
    expect([...i18n.supportedLangs].sort()).toEqual(["en", "sv"]);
  });
});

describe("preference mirror", () => {
  it("reads a stored preference and ignores unsupported values", () => {
    const i18n = makeI18n();
    expect(i18n.readLanguagePreference()).toBe("en"); // detection default
    localStorage.setItem("test.language", "sv");
    expect(i18n.readLanguagePreference()).toBe("sv");
    localStorage.setItem("test.language", "de");
    // unsupported → falls through to detection (en here)
    expect(i18n.readLanguagePreference()).toBe("en");
  });

  it("writes the preference and broadcasts the switch event", () => {
    const i18n = makeI18n();
    const handler = vi.fn();
    window.addEventListener("test:language", handler);
    i18n.writeLanguagePreference("sv");
    expect(localStorage.getItem("test.language")).toBe("sv");
    expect(handler).toHaveBeenCalledOnce();
    window.removeEventListener("test:language", handler);
  });
});

describe("detectBrowserLanguage", () => {
  it("prefix-matches navigator.language against supported langs", () => {
    vi.stubGlobal("navigator", { language: "sv-SE" });
    expect(detectBrowserLanguage(["en", "sv"], "en")).toBe("sv");
    vi.stubGlobal("navigator", { language: "fr-FR" });
    expect(detectBrowserLanguage(["en", "sv"], "en")).toBe("en");
  });
});

describe("useT / LanguageRoot", () => {
  it("useT resolves against the active context language", async () => {
    const i18n = makeI18n();
    await i18n.ensureCatalog("sv");
    const { result } = renderHook(() => i18n.useT(), {
      wrapper: ({ children }) => (
        <i18n.LanguageProvider value="sv">{children}</i18n.LanguageProvider>
      ),
    });
    expect(result.current("common.close")).toBe("Stäng");
  });

  it("LanguageRoot renders the stored language and tracks <html lang>", async () => {
    localStorage.setItem("test.language", "sv");
    const i18n = makeI18n();
    function Probe() {
      const t = i18n.useT();
      return <span>{t("common.close")}</span>;
    }
    render(
      <i18n.LanguageRoot>
        <Probe />
      </i18n.LanguageRoot>,
    );
    // Returning Swedish user: gated until the sv catalog loads, then renders.
    await waitFor(() => screen.getByText("Stäng"));
    expect(document.documentElement.lang).toBe("sv-SE");
  });

  it("applies a runtime switch broadcast through the event", async () => {
    const i18n = makeI18n();
    function Probe() {
      const t = i18n.useT();
      return <span>{t("nav.home")}</span>;
    }
    render(
      <i18n.LanguageRoot>
        <Probe />
      </i18n.LanguageRoot>,
    );
    screen.getByText("Home");
    await act(async () => {
      i18n.setLanguage("sv");
      // let ensureCatalog + setLang settle
      await Promise.resolve();
    });
    await waitFor(() => screen.getByText("Hem"));
    expect(document.documentElement.lang).toBe("sv-SE");
  });
});
