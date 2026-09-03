// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Postal addresses as *text*: three structured parts in, display lines, a
// one-line rendering and a maps deep link out — plus a best-effort read of an
// old free-form blob back into those parts, for the migration that introduces
// them.
//
// Storing an address as `street` / `zip` / `city` rather than one free-form
// field is what lets a card lay it out properly and hand a clean query to a
// maps app. These helpers are the pure seam over those fields; anything an
// address is attached *to* stays in the app.
//
// Pure functions over a plain shape — no DOM — so the whole surface is
// node-testable.

export type AddressParts = {
  street?: string;
  zip?: string;
  city?: string;
};

/** Whether any of the three parts carries content. */
export function hasAddress(a: AddressParts): boolean {
  return !!(a.street?.trim() || a.zip?.trim() || a.city?.trim());
}

/** The address as display lines — the street on its own line, then the
 *  "zip city" locality line — with blank parts dropped. */
export function addressLines(a: AddressParts): string[] {
  const lines: string[] = [];
  const street = a.street?.trim();
  if (street) lines.push(street);
  const locality = [a.zip?.trim(), a.city?.trim()].filter(Boolean).join(" ");
  if (locality) lines.push(locality);
  return lines;
}

/** The address as one comma-joined line — the maps query, and what a search
 *  index or an export sees. */
export function formatAddress(a: AddressParts): string {
  return addressLines(a).join(", ");
}

/** A universal maps deep link for the address. The `?api=1&query=` Google Maps
 *  search URL is the portable choice: on a phone the OS hands it off to the
 *  installed map app, and on the desktop it opens Google Maps in the browser. */
export function mapsUrl(a: AddressParts): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    formatAddress(a),
  )}`;
}

// Match a "zip city" or "city zip" locality — a postal code is a run of 4–6
// digits (optionally split once, as Swedish "123 45") sitting beside the town.
function splitLocality(s: string): { zip: string; city: string } | null {
  const text = s.trim();
  let m = /^(\d{3}\s?\d{2}|\d{4,6})\s+(.+)$/.exec(text);
  if (m) return { zip: m[1]!.replace(/\s+/g, " "), city: m[2]!.trim() };
  m = /^(.+?)\s+(\d{3}\s?\d{2}|\d{4,6})$/.exec(text);
  if (m) return { zip: m[2]!.replace(/\s+/g, " "), city: m[1]!.trim() };
  return null;
}

/** Best-effort split of a free-form (possibly multi-line) address into the
 *  three structured parts. What a migration carries an old single-field
 *  address forward through; it never has to be perfect, only sensible. */
export function parseAddress(raw: string): AddressParts {
  const text = raw.trim();
  if (!text) return {};
  // Prefer explicit line breaks; fall back to comma separation on one line.
  const segments = (text.includes("\n") ? text.split(/\n+/) : text.split(","))
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length === 0) return {};
  if (segments.length === 1) {
    const locality = splitLocality(segments[0]!);
    return locality ?? { street: segments[0] };
  }
  const street = segments.slice(0, -1).join(", ");
  const tail = segments[segments.length - 1]!;
  const locality = splitLocality(tail);
  return locality ? { street, ...locality } : { street, city: tail };
}
