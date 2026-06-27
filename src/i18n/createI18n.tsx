// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The i18n factory. `createI18n(config)` builds a self-contained, typed
// translation runtime over your catalogs: one React context carries the
// active language, one typed `t()` reads from per-language catalog modules,
// and non-fallback languages are code-split and loaded on demand. No
// third-party dependency, no namespaces — just a typed lookup with
// `{name}`-style interpolation.
//
// The fallback language (usually English) is bundled: it is the default, the
// fallback for any not-yet-loaded key, and the source of the compile-time
// `MessageKey` type. Every other language loads on demand via `ensureCatalog`,
// so a language the user never selects costs nothing at first paint. Lookups
// stay synchronous — `t()` falls back to the fallback catalog for any key
// whose catalog isn't resident yet, and `LanguageRoot` loads the active
// catalog before applying it, so that fallback is a safety net rather than a
// visible state.
//
// All runtime state lives in the closure of one `createI18n` call, so several
// independent runtimes (a test, a preview, a second mount) never share a
// catalog cache.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  detectBrowserLanguage,
  flattenCatalog,
  formatMessage,
} from "./locale.ts";
import type {
  CatalogShape,
  I18n,
  I18nConfig,
  Leaves,
  TFunction,
} from "./types.ts";

export function createI18n<Lang extends string, C extends CatalogShape>(
  config: I18nConfig<Lang, C>,
): I18n<Lang, C> {
  const {
    fallbackLang,
    fallbackCatalog,
    toBcp47 = (lang: Lang) => lang,
    detectLanguage = detectBrowserLanguage,
    storageKey = "oss.language",
    eventName = "oss:language",
  } = config;
  const loaders: Partial<Record<Lang, () => Promise<C>>> = config.loaders ?? {};

  const supportedLangs: readonly Lang[] =
    config.supportedLangs ??
    dedupe<Lang>([fallbackLang, ...(Object.keys(loaders) as Lang[])]);

  function isSupported(value: unknown): value is Lang {
    return typeof value === "string" && supportedLangs.includes(value as Lang);
  }

  // The fallback catalog is resident from the start; every other language is
  // flattened into this map once its loader resolves.
  const flatCatalogs = new Map<Lang, Map<string, string>>([
    [fallbackLang, flattenCatalog(fallbackCatalog)],
  ]);
  // De-dupe concurrent loads of the same language (StrictMode's double effect,
  // a render firing before the first load resolves).
  const inFlight = new Map<Lang, Promise<void>>();

  function isCatalogLoaded(lang: Lang): boolean {
    return flatCatalogs.has(lang);
  }

  function ensureCatalog(lang: Lang): Promise<void> {
    if (isCatalogLoaded(lang)) return Promise.resolve();
    const existing = inFlight.get(lang);
    if (existing) return existing;
    const loader = loaders[lang];
    if (!loader) return Promise.resolve();
    const p = loader().then((catalog) => {
      flatCatalogs.set(lang, flattenCatalog(catalog));
      inFlight.delete(lang);
    });
    inFlight.set(lang, p);
    return p;
  }

  function lookup(lang: Lang, key: string): string {
    const fallbackMap = flatCatalogs.get(fallbackLang);
    const raw =
      flatCatalogs.get(lang)?.get(key) ?? fallbackMap?.get(key) ?? key;
    return raw;
  }

  function tFor(
    lang: Lang,
    key: Leaves<C>,
    params?: Record<string, string | number>,
  ): string {
    return formatMessage(lookup(lang, key), params);
  }

  // --- preference mirror ---------------------------------------------------

  function readLanguagePreference(): Lang {
    try {
      const raw = localStorage.getItem(storageKey);
      if (isSupported(raw)) return raw;
    } catch {
      // localStorage can throw under private-mode quotas / sandboxed iframes —
      // fall through to detection.
    }
    return detectLanguage(supportedLangs, fallbackLang);
  }

  function writeLanguagePreference(lang: Lang): void {
    try {
      localStorage.setItem(storageKey, lang);
    } catch {
      // Silent: the mirror is a UX nicety, not the source of truth.
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent<Lang>(eventName, { detail: lang }));
    }
  }

  // --- React surface -------------------------------------------------------

  const LanguageContext = createContext<Lang>(fallbackLang);

  function LanguageProvider({
    value,
    children,
  }: {
    value: Lang;
    children: ReactNode;
  }) {
    return (
      <LanguageContext.Provider value={value}>
        {children}
      </LanguageContext.Provider>
    );
  }

  function useLang(): Lang {
    return useContext(LanguageContext);
  }

  function useT(): TFunction<C> {
    const lang = useContext(LanguageContext);
    return useCallback<TFunction<C>>(
      (key, params) => formatMessage(lookup(lang, key), params),
      [lang],
    );
  }

  function LanguageRoot({ children }: { children: ReactNode }) {
    const [lang, setLang] = useState<Lang>(() => readLanguagePreference());
    // The fallback language is resident synchronously, so fallback users never
    // gate; a returning non-fallback user gates until the catalog loads.
    const [booted, setBooted] = useState<boolean>(() => isCatalogLoaded(lang));

    useEffect(() => {
      // Apply a switch only once its catalog is resident. Flipping the context
      // to a not-yet-loaded language would render the fallback and leave it
      // stuck there (the context value wouldn't change again when the catalog
      // later arrives). Loading first means the single context change already
      // has the real strings.
      const onChange = (e: Event) => {
        const detail = (e as CustomEvent<unknown>).detail;
        if (!isSupported(detail)) return;
        void ensureCatalog(detail).then(() => setLang(detail));
      };
      window.addEventListener(eventName, onChange);
      return () => window.removeEventListener(eventName, onChange);
    }, []);

    useEffect(() => {
      document.documentElement.lang = toBcp47(lang);
    }, [lang]);

    useEffect(() => {
      if (isCatalogLoaded(lang)) {
        setBooted(true);
        return;
      }
      // Only reached for a returning non-fallback user on first paint — load
      // the persisted language's catalog, then unblock the render.
      let cancelled = false;
      void ensureCatalog(lang).then(() => {
        if (!cancelled) setBooted(true);
      });
      return () => {
        cancelled = true;
      };
    }, [lang]);

    return (
      <LanguageProvider value={lang}>
        {booted ? children : null}
      </LanguageProvider>
    );
  }

  return {
    LanguageProvider,
    LanguageRoot,
    useT,
    useLang,
    ensureCatalog,
    isCatalogLoaded,
    tFor,
    readLanguagePreference,
    writeLanguagePreference,
    setLanguage: writeLanguagePreference,
    supportedLangs,
    toBcp47,
  };
}

function dedupe<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
