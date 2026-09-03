// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
//
// What the clipboard has to offer an expression input. A paste gesture asks
// this module what — if anything — is worth pasting, and the affordance only
// appears when the answer is not null:
//
//   - text the grammar already understands ("12×4.5", "0xFF") pastes
//     verbatim, whatever it came from;
//   - text we cannot parse gives up its first number instead ("Total:
//     $1,234.56" → "1234.56"), which is the honest reading of "paste the
//     numbers in the clipboard";
//   - text with no number in it at all offers nothing, and the gesture stays
//     silent.
//
// The pasted text lands on the input exactly as if it had been typed, so
// everything here stays inside the one grammar (`evaluate.ts`). Pure and
// DOM-free — reading the clipboard itself is the app's business (the
// framework's `useClipboard` covers the write half).

import { isEvaluable } from "./evaluate.ts";

/** Whether the clipboard parsed as a whole, or only gave up a number. */
export type PasteKind = "expression" | "number";

export type PasteCandidate = {
  /** The text that would land on the input. */
  text: string;
  kind: PasteKind;
};

// How much of the pasted text the button shows before eliding it.
const LABEL_MAX = 18;

// Whitespace carries no meaning in the grammar and turns up everywhere in
// copied text — line breaks, and the non-breaking and thin spaces used as
// thousands separators — so it goes first. `\s` covers all of them.
function squash(text: string): string {
  return text.replace(/\s+/g, "");
}

// The first number-shaped run in the text, separators and all.
const NUMBER = /-?\d[\d.,']*/;

// A number written in three-digit groups. Never applied to one that leads
// with a zero — "0,500" is half, not five hundred. A lone dot is exempt: it
// is the grammar's own decimal separator, so a value copied out of an
// expression must paste back as itself ("1.234" is 1.234, but "1.234.567" is
// grouped).
function isGrouped(digits: string, separator: "." | ","): boolean {
  if (digits.startsWith("0")) return false;
  return separator === "."
    ? /^\d{1,3}(?:\.\d{3}){2,}$/.test(digits)
    : /^\d{1,3}(?:,\d{3})+$/.test(digits);
}

// Where the decimal point sits in a number-shaped run, or -1 when every
// separator in it is grouping.
function decimalIndex(digits: string): number {
  const comma = digits.lastIndexOf(",");
  const dot = digits.lastIndexOf(".");
  // Both kinds present: the last one is the decimal point and the other is
  // grouping, whichever way round the locale writes them — "1,234.56" and
  // "1.234,56" are the same number.
  if (comma >= 0 && dot >= 0) return Math.max(comma, dot);
  if (dot >= 0) return isGrouped(digits, ".") ? -1 : dot;
  if (comma >= 0) return isGrouped(digits, ",") ? -1 : comma;
  return -1;
}

// Rewrite a number-shaped run as plain digits with a `.` decimal point, or
// null when nothing survives.
function plainNumber(run: string): string | null {
  const negative = run.startsWith("-");
  // Apostrophes only ever group; trailing separators belong to the prose the
  // number was lifted out of ("2." at the end of a sentence).
  const digits = run
    .replace(/^-/, "")
    .replace(/'/g, "")
    .replace(/[.,]+$/, "");
  const at = decimalIndex(digits);
  const bare = (part: string) => part.replace(/[.,]/g, "");
  const whole = at < 0 ? bare(digits) : bare(digits.slice(0, at));
  const fraction = at < 0 ? "" : bare(digits.slice(at + 1));
  const value = fraction ? `${whole || "0"}.${fraction}` : whole;
  if (!value) return null;
  return negative ? `-${value}` : value;
}

/**
 * What a paste of `clipboard` would put on the input, or null when there is
 * nothing in it worth offering.
 */
export function pasteCandidate(clipboard: string): PasteCandidate | null {
  const text = squash(clipboard);
  if (!text) return null;
  if (isEvaluable(text)) return { text, kind: "expression" };
  const number = plainNumber(NUMBER.exec(text)?.[0] ?? "");
  return number === null ? null : { text: number, kind: "number" };
}

/**
 * What an affordance says it would take or add, cut short when it is longer
 * than a button can honestly show. Naming the text matters: a number salvaged
 * out of prose is not what the user copied, and saying so is the difference
 * between a paste and a surprise.
 */
export function pasteLabel(text: string): string {
  return text.length > LABEL_MAX ? `${text.slice(0, LABEL_MAX - 1)}…` : text;
}
