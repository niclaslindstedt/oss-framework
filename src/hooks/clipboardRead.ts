// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

// Reading the system clipboard — the other half of `useClipboard`, which only
// writes.
//
// Writing is easy and reading is not, because reading is a **permission**. The
// async clipboard is behind a granted permission on Chromium, behind the
// browser's own Paste button on WebKit, and absent altogether on some engines.
// So the rule here is that **every failure is "nothing"**: a browser without
// the API, a permission declined, a clipboard holding a spreadsheet, a blob
// that will not decode — all of them come back empty, and the caller simply
// does not offer the paste. Nothing on this path is load-bearing.
//
// Three things about it are easy to get wrong, and all three are why this is a
// module rather than a call to `navigator.clipboard.read()`:
//
//   - **Asking costs something, and not the same everywhere.** On a Chromium
//     that has already granted `clipboard-read`, a look is free and silent — a
//     caller may take one just to decide whether to *offer* a paste. Anywhere
//     else, a look puts the system's own Paste button in front of the user and
//     waits. Raising that out of nowhere, when they only opened a dialog, is
//     baffling. {@link clipboardLookIsFree} is what separates the two, and the
//     two deadlines below are why they are separate calls.
//   - **One read, not two.** A single `read()` hands over every flavour the
//     clipboard is holding at once. Reading the text and then the picture would
//     raise that prompt *twice* for one press of Paste — so this reads once and
//     hands back everything, and the caller ranks the flavours itself. Which
//     flavour wins is a question about the app, not about the clipboard.
//   - **`read()` does not always settle.** A browser waiting on a prompt — or
//     on a page that has not been clicked yet — simply leaves the promise
//     pending. A button stuck saying "asking…" forever is worse than one that
//     never offered.

/** One flavour the clipboard, or a paste event, was holding. */
export type ClipboardContent =
  { kind: "text"; text: string } | { kind: "blob"; type: string; blob: Blob };

/** The async clipboard, as much of it as this module uses — typed by hand
 *  because `navigator.clipboard.read` is not in every TypeScript DOM lib. */
interface ClipboardEntry {
  types: readonly string[];
  getType: (type: string) => Promise<Blob>;
}

interface AsyncClipboard {
  read?: () => Promise<readonly ClipboardEntry[]>;
  readText?: () => Promise<string>;
}

function asyncClipboard(): AsyncClipboard | undefined {
  return typeof navigator === "undefined"
    ? undefined
    : (navigator as Navigator & { clipboard?: AsyncClipboard }).clipboard;
}

/** How long a *free* look gets before it counts as empty.
 *
 *  Far longer than a clipboard read that is going to happen takes, and short
 *  enough that a promise which never settles does not hold a dialog open. */
export const CLIPBOARD_FREE_LOOK_MS = 1500;

/** How long a look the user *asked for* gets.
 *
 *  Not a deadline anybody has to beat: the browser's own Paste button is up,
 *  finding and tapping it takes a person seconds, and cutting that short is
 *  exactly the bug the free/asked-for split exists to fix. It is only a
 *  backstop against a promise that never settles at all. */
export const CLIPBOARD_USER_ANSWER_MS = 60_000;

/** Whether this browser will hand the clipboard over at all, however much it
 *  insists on asking first.
 *
 *  `false` is a browser where no amount of pressing will produce anything, so
 *  the caller should not offer the press. */
export function clipboardCanBeRead(): boolean {
  return Boolean(asyncClipboard()?.read);
}

/** Whether a look would be **free** — no prompt, no system button, nothing in
 *  front of the user.
 *
 *  Only one answer counts as free: a `clipboard-read` permission that has
 *  already been *granted*. `prompt` is not free (that is the permission
 *  dialog), a browser with no Permissions API is not free (that is WebKit,
 *  which shows its own Paste button instead), and a browser without `read()`
 *  has nothing to look at. Every one of those is `false`, and the caller asks
 *  the user rather than peeking. */
export async function clipboardLookIsFree(): Promise<boolean> {
  if (!clipboardCanBeRead()) return false;
  try {
    const permissions = (
      navigator as Navigator & {
        permissions?: {
          query?: (d: { name: string }) => Promise<{ state: string }>;
        };
      }
    ).permissions;
    if (!permissions?.query) return false;
    const status = await permissions.query({ name: "clipboard-read" });
    return status.state === "granted";
  } catch {
    // A browser that does not know the name — WebKit and Gecko both throw
    // here. Not free, then.
    return false;
  }
}

export interface ReadClipboardOptions {
  /** How long to wait before giving up and answering empty. Defaults to
   *  {@link CLIPBOARD_USER_ANSWER_MS} — pass {@link CLIPBOARD_FREE_LOOK_MS}
   *  for a peek taken behind the user's back. */
  timeoutMs?: number;
  /** Which MIME types are worth pulling the bytes for. Text is always read.
   *  Defaults to every `image/*`; pass `() => false` to read text alone. */
  accept?: (type: string) => boolean;
}

const acceptsImages = (type: string) => type.startsWith("image/");

/** Everything one look at the clipboard turned up, in the order the browser
 *  reported it — **not** ranked. Empty for every one of the many ways there is
 *  nothing, including a look that was refused or never answered.
 *
 *  Ranking is the caller's: which of a picture, a payload the app itself wrote,
 *  and some words wins is a question about the app. What this guarantees is
 *  that deciding it costs *one* look. */
export async function readClipboard(
  options: ReadClipboardOptions = {},
): Promise<ClipboardContent[]> {
  const { timeoutMs = CLIPBOARD_USER_ANSWER_MS, accept = acceptsImages } =
    options;
  const clipboard = asyncClipboard();
  if (!clipboard) return [];
  if (!clipboard.read) {
    // No `read()` to take: words are all this browser will hand over.
    try {
      const text = (await clipboard.readText?.()) ?? "";
      return text ? [{ kind: "text", text }] : [];
    } catch {
      return [];
    }
  }
  const read = clipboard.read;
  return within(collect(read, accept), timeoutMs, []);
}

/** The same question asked of a `paste` (or `drop`) event's `DataTransfer`.
 *
 *  This is the **good** path and worth preferring wherever there is an event
 *  to read: a real paste hands its data over synchronously, with no permission
 *  and no prompt. Reach for {@link readClipboard} only when there is no event —
 *  a menu's own Paste item. */
export async function readDataTransfer(
  data: DataTransfer | null,
  accept: (type: string) => boolean = acceptsImages,
): Promise<ClipboardContent[]> {
  if (!data) return [];
  const found: ClipboardContent[] = [];
  const text = data.getData("text/plain");
  if (text) found.push({ kind: "text", text });
  for (const file of data.files ?? []) {
    if (accept(file.type))
      found.push({ kind: "blob", type: file.type, blob: file });
  }
  return found;
}

/** The first text flavour, trimmed of the trailing newline a copied line
 *  brings with it, or `null`. */
export function clipboardText(
  found: readonly ClipboardContent[],
): string | null {
  for (const item of found) {
    if (item.kind !== "text") continue;
    const words = item.text.replace(/\s+$/u, "");
    if (words) return words;
  }
  return null;
}

/** The first blob whose type `matches`, or `null`. Defaults to any image. */
export function clipboardBlob(
  found: readonly ClipboardContent[],
  matches: (type: string) => boolean = acceptsImages,
): { type: string; blob: Blob } | null {
  for (const item of found) {
    if (item.kind === "blob" && matches(item.type)) {
      return { type: item.type, blob: item.blob };
    }
  }
  return null;
}

async function collect(
  read: () => Promise<readonly ClipboardEntry[]>,
  accept: (type: string) => boolean,
): Promise<ClipboardContent[]> {
  const found: ClipboardContent[] = [];
  try {
    for (const entry of await read()) {
      if (entry.types.includes("text/plain")) {
        const text = await entry
          .getType("text/plain")
          .then((blob) => blob.text())
          .catch(() => "");
        if (text) found.push({ kind: "text", text });
      }
      const type = entry.types.find((t) => t !== "text/plain" && accept(t));
      if (!type) continue;
      const blob = await entry.getType(type).catch(() => null);
      if (blob) found.push({ kind: "blob", type, blob });
    }
  } catch {
    // Denied, dismissed, unsupported, or a clipboard we simply may not read.
    return found;
  }
  return found;
}

function within<T>(work: Promise<T>, ms: number, spent: T): Promise<T> {
  return Promise.race([
    work,
    new Promise<T>((resolve) => {
      setTimeout(() => resolve(spent), ms);
    }),
  ]);
}
