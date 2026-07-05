// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Digit-grouping primitives. Small pure helpers that express *how digits
// clump* — fixed-size runs, pairs with a leading triple — with no knowledge of
// any one convention. An app's formatters (a number scheme, a reference code,
// an account layout) build their per-locale rules from these.

/** Strip everything but digits. */
export function digitsOnly(input: string): string {
  return input.replace(/\D/g, "");
}

/** Group a run of digits into fixed-size chunks joined by `sep` (spaces by
 *  default). The trailing chunk keeps whatever digits remain. */
export function groupDigits(digits: string, size = 3, sep = " "): string {
  const groups: string[] = [];
  for (let i = 0; i < digits.length; i += size) {
    groups.push(digits.slice(i, i + size));
  }
  return groups.join(sep);
}

/** Group digits into pairs from the left, letting the *first* group be a triple
 *  when the count is odd — the "three together if possible, otherwise groups of
 *  two" rule several European conventions share. `"8181337"` → `"818 13 37"`,
 *  `"123456"` → `"12 34 56"`. */
export function groupPairsLeadingTriple(digits: string, sep = " "): string {
  if (digits.length === 0) return "";
  const groups: string[] = [];
  let i = 0;
  if (digits.length % 2 === 1) {
    groups.push(digits.slice(0, 3));
    i = 3;
  }
  for (; i < digits.length; i += 2) groups.push(digits.slice(i, i + 2));
  return groups.join(sep);
}
