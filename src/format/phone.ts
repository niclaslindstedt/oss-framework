// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Phone numbers as *text*: pulling a free-typed one apart, folding it down to
// the shape worth storing, and spelling it back out for a `tel:` link.
//
// Deliberately **not** here: how a country groups its national digits, or
// which one the app should assume. That is a per-country convention (and a
// setting an app exposes), so the module stops at the seam every convention
// starts from — country calling code, national significant digits and
// extension, separated. `digits.ts`'s `groupDigits` and
// `groupPairsLeadingTriple` are the primitives a convention is then written
// with.
//
// Pure functions over strings — no DOM, no locale lookup, no clock.

import { digitsOnly } from "./digits.ts";

// --- Phone parsing -----------------------------------------------------------

/** The structured shape `parsePhone` recovers from a free-typed number. This is
 *  the input every country's phone formatter receives — country code and
 *  national digits already separated, so a formatter only decides grouping. */
export type ParsedPhone = {
  /** Country calling code without the leading `+` ("46"), or null when the
   *  input carried no explicit international prefix. */
  countryCode: string | null;
  /** National significant digits — no country code, no separators. May keep a
   *  leading trunk 0 when the number was typed in local form (a country
   *  formatter normalises this as its convention dictates). */
  national: string;
  /** Trailing extension digits ("x123"), or null. */
  ext: string | null;
  /** The original input, trimmed. */
  raw: string;
  /** True once at least one national digit was recovered. */
  valid: boolean;
};

// A table of E.164 calling codes, longest first so the prefix match is greedy
// (so "1" never shadows "1..."). This is numbering-plan data, not a formatting
// choice — it only helps `parsePhone` peel an explicit international prefix off
// the front. A country not listed here still parses; its digits simply stay in
// `national`. Only consulted when the input opens with `+` or `00`.
const CALLING_CODES = [
  "971",
  "972",
  "358",
  "353",
  "354",
  "351",
  "352",
  "420",
  "386",
  "372",
  "46",
  "47",
  "45",
  "49",
  "44",
  "33",
  "39",
  "34",
  "31",
  "41",
  "43",
  "32",
  "61",
  "64",
  "65",
  "81",
  "82",
  "48",
  "30",
  "91",
  "86",
  "52",
  "55",
  "1",
  "7",
];

/** Pull a free-typed phone number apart into country code / national digits /
 *  extension. Non-destructive and forgiving: anything it can't classify falls
 *  through to `national`, and `valid` reports whether any digit was found. */
export function parsePhone(input: string): ParsedPhone {
  const raw = input.trim();

  // Peel a trailing extension ("x123", "ext. 5", "#5") off the end first.
  let body = raw;
  let ext: string | null = null;
  const extMatch = /(?:\s*(?:ext\.?|extension|x|#)\s*)(\d{1,6})\s*$/i.exec(
    body,
  );
  if (extMatch) {
    ext = extMatch[1]!;
    body = body.slice(0, extMatch.index);
  }

  const international = /^\s*(?:\+|00)/.test(body);
  const digits = body.replace(/\D/g, "");
  // "00" is the international access prefix, not part of the number.
  const significant =
    international && digits.startsWith("00") ? digits.slice(2) : digits;

  let countryCode: string | null = null;
  let national = significant;
  if (international) {
    const cc = CALLING_CODES.find((code) => significant.startsWith(code));
    if (cc && significant.length > cc.length) {
      countryCode = cc;
      national = significant.slice(cc.length);
    }
  }

  return { countryCode, national, ext, raw, valid: national.length > 0 };
}

// --- Structured storage ------------------------------------------------------
// A phone is worth storing *structured*: national digits (no separators, no
// country code) plus its E.164 calling code. These two helpers are the single
// conversion between a free-typed string and that shape — the one an edit
// form commits through, a document migration lifts old values through, and an
// importer folds a foreign record through.

/** The stored shape a free-typed phone number folds down to: national digits
 *  only, plus the E.164 calling code when the input carried an explicit
 *  international prefix (`+…` / `00…`). Separators and any trailing extension
 *  are dropped — the value is left as bare national digits. `countryCode` is
 *  omitted (not `null`) when the number carried no code, so it can be spread
 *  straight onto a stored record. */
export function toStoredPhone(input: string): {
  value: string;
  countryCode?: string;
} {
  const parsed = parsePhone(input);
  return parsed.countryCode
    ? { value: parsed.national, countryCode: parsed.countryCode }
    : { value: parsed.national };
}

/** The full dialable string for a stored phone — `+<code><national>` when it
 *  carries a calling code, else the bare national digits. What a `tel:` link
 *  and an export write. Empty when there are no national digits. */
export function phoneDialString(phone: {
  value: string;
  countryCode?: string | null;
}): string {
  const national = digitsOnly(phone.value);
  if (!national) return "";
  return phone.countryCode ? `+${phone.countryCode}${national}` : national;
}

/**
 * Render a parsed extension as a human suffix (" ext. 42"), or "" when there
 * is none. `label` is the word in front of the digits — English by default,
 * since the library carries no i18n; pass the app's own translation.
 */
export function extSuffix(ext: string | null, label = "ext."): string {
  return ext ? ` ${label} ${ext}` : "";
}
