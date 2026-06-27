// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Framework-free helpers around a two-letter language code. No React, no
// catalog modules — safe to import from anywhere, including non-component
// code and a React Native shell that shares the catalog runtime.

// First-run language detection, used only when no preference is stored yet.
// Returns the first supported language whose code prefixes
// `navigator.language` (so `"sv-SE"` matches `"sv"`), else the fallback.
// `navigator` is often absent off the web (SSR, React Native), where this
// safely returns the fallback.
export function detectBrowserLanguage<L extends string>(
  supported: readonly L[],
  fallback: L,
): L {
  if (typeof navigator === "undefined") return fallback;
  const raw = (navigator.language ?? "").toLowerCase();
  if (!raw) return fallback;
  return (
    supported.find((lang) => raw.startsWith(lang.toLowerCase())) ?? fallback
  );
}

// Interpolate `{name}`-style placeholders. An unmatched placeholder is left
// verbatim so a missing param is visible rather than silently blank.
export function formatMessage(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = params[key];
    return value === undefined ? match : String(value);
  });
}

// Flatten a nested catalog into a `dotted.path → string` map so a lookup is a
// single `Map.get` instead of walking the object on every call.
export function flattenCatalog(catalog: unknown): Map<string, string> {
  const out = new Map<string, string>();
  walk(catalog, "", out);
  return out;
}

function walk(obj: unknown, prefix: string, out: Map<string, string>): void {
  if (obj === null || typeof obj !== "object") return;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix === "" ? k : `${prefix}.${k}`;
    if (typeof v === "string") out.set(path, v);
    else walk(v, path, out);
  }
}
