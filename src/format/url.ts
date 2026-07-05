// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Tidying a user-typed website into a link target. A URL field accepts a bare
// "example.com" as readily as a full "https://example.com"; a read view's link
// needs a real URL, so this fills in a scheme when one is missing. Pure and
// node-testable — no DOM.

/** Turn a user-typed website into an href. A value that already carries a
 *  scheme ("https://", "http://", "mailto:") is left as-is; a bare host gets an
 *  `https://` prefix. An empty / whitespace value returns an empty string, so
 *  the caller can skip rendering a link. */
export function normalizeUrl(value: string | undefined): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** The value shown for a website link — the URL without its scheme and any
 *  trailing slash, so "https://example.com/" reads as "example.com". Falls back
 *  to the raw value when it can't be parsed. */
export function displayUrl(value: string | undefined): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";
  return trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").replace(/\/+$/, "");
}
