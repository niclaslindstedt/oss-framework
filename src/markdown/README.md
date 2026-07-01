<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# `@niclaslindstedt/oss-framework/markdown`

A live-preview Markdown editor — the Obsidian-style "format every line except
the one you're editing" experience — plus the dependency-free parser it renders
from. The editor is one self-contained widget you control with `body` +
`onChange`; the parser is exported on its own for any app that wants to classify
or render Markdown without the editor.

## What it is / what it owns vs. what stays in your app

- **The framework owns** the whole editing widget: one `contenteditable` surface
  that renders every line formatted except the caret's (shown as raw source),
  all the caret/selection/keyboard plumbing (every edit is intercepted at
  `beforeinput` and applied to the source through a pure line-edit engine, so
  Enter/Backspace/Delete/typing/paste never corrupt the DOM; the browser owns
  native caret glide, Ctrl/Cmd+A, and cross-line touch selection), IME
  composition, the mobile soft-keyboard reveal, and copy/cut-as-verbatim-source.
  It also owns the pure parser and line-edit engine.
- **Your app owns** the document and where it lives. The editor is **controlled**:
  it holds no persistence and never writes to disk. You pass the current `body`
  string and a `onChange(body)` callback, and you decide how (and whether) to
  store it. It carries no i18n (one optional placeholder string) and no domain
  types.

The seam is the `body` string. The editor reads it, re-derives everything from
it on every keystroke, and hands you the next string through `onChange` — every
edit runs through the pure `replaceRange` engine, so it never reads formatted
DOM back.

## The contract

- **CSS variables / theme tokens.** The editor and renderer paint through the
  framework's theme token vocabulary — `--color-fg`, `--color-fg-bright`,
  `--color-muted`, `--color-accent`, `--color-line`, `--color-link`,
  `--color-surface-2` (via the Tailwind `text-fg`, `bg-surface-2`, … utilities).
  Apply a framework theme (`useApplyTheme`) and they follow it with no extra
  wiring.
- **DOM attributes.** Every rendered inline leaf is stamped with `data-src` (its
  first character's source column) and rendered lines with `data-line-index`, so
  a click maps back to a caret column and a selection maps back to source. A
  shortened bare URL also carries `data-len` (its source length). These are
  internal to the editor; you don't set them.
- **Layout.** The editor renders a scroll container that fills its parent
  (`flex-1`, `min-h-0`). Give it a flex column with a bounded height.

## Generic usage

```bash
npm install @niclaslindstedt/oss-framework
```

```tsx
import { useState } from "react";
import { MarkdownEditor } from "@niclaslindstedt/oss-framework/markdown";

function NoteEditor({ id }: { id: string }) {
  const [body, setBody] = useState("");
  return (
    <div className="flex h-full flex-col">
      {/* Key by document id so switching documents remounts rather than
          reconciling mid-edit. */}
      <MarkdownEditor key={id} body={body} onChange={setBody} />
    </div>
  );
}
```

### `MarkdownEditor` props

| Prop                 | Type                        | Default          | Notes                                                                   |
| -------------------- | --------------------------- | ---------------- | ----------------------------------------------------------------------- |
| `body`               | `string`                    | —                | The document source (required, controlled).                             |
| `onChange`           | `(body: string) => void`    | —                | Fires on every edit with the next source (required).                    |
| `wordWrap`           | `boolean`                   | `true`           | Wrap long lines, or scroll horizontally.                                |
| `disableSpellcheck`  | `boolean`                   | `false`          | Turn off the browser's red squiggles.                                   |
| `disableAutocorrect` | `boolean`                   | `false`          | Turn off mobile autocorrect + auto-capitalisation.                      |
| `maxWidth`           | `string`                    | `"none"`         | Max width of the writing column (e.g. `"42rem"`); `"none"` for full.    |
| `focusOnMount`       | `boolean`                   | `true`           | Open the caret in the body on mount (`false` to start fully formatted). |
| `shortenLinkChars`   | `number`                    | `0`              | Trim bare URLs to N chars either side in the preview (0 = off).         |
| `labels`             | `MarkdownEditorLabels`      | English defaults | `{ startWriting }` — the empty-document placeholder.                    |
| `ref`                | `Ref<MarkdownEditorHandle>` | —                | `handle.focus()` drops the caret at the end of the document.            |

### The parser, on its own

```ts
import {
  classifyLines, // (body) => LineBlock[]   one block per source line
  parseInline, // (text, base?) => InlineNode[]  bold/italic/code/links…
  shortenUrl, // (url, chars) => string   elide a long URL for display
} from "@niclaslindstedt/oss-framework/markdown";
```

`classifyLines` assigns each line a `BlockKind` (`heading`, `ul`, `ol`, `quote`,
`hr`, `fence`, `code`, `paragraph`, `blank`) with the content offset; `parseInline`
tokenises a line into `InlineNode`s carrying absolute source offsets. Both are
pure and DOM-free — cheap to unit-test and reuse (e.g. to render a read-only
preview, or to copy a list as plain text). `RenderedLine`, `lineTextClass`,
`sourcePointFromDom`, `extractSourceRange`, `snapStartToLineEdge`, and the pure
line-edit engine (`replaceRange`, `orderPoints`, `pointsEqual`) are exported too
for an app that builds its own renderer or editing surface over the same parse.

## Images and links

The editor renders links and images whose href is a **loadable URL**
(`http(s):`, `data:`, `blob:`, or a `/`-rooted path) as real anchors / `<img>`
elements. Any other reference — a bare or app-relative path like
`![](attachments/x.png)` — is left as visible, editable raw `![…](…)` markdown
rather than rendering broken. If your app stores its own assets (an attachment
store, a CDN with signed URLs), resolve those references to loadable URLs in
your `onChange`/load path, or render a read-only preview with your own renderer
over `classifyLines` + `parseInline`.

## Lists and nesting

Indented list items render with a depth-aware marker so nested levels read
apart at a glance: bullets step `•` → `–` → `+` and ordered items step decimal
→ lower-alpha → lower-roman (`1.` → `a.` → `i.`), re-using whatever separator
the source typed (`.` or `)`). One nesting level is two columns of leading
indentation (a tab counts as two), exposed on each `LineBlock` as `depth` for an
app rendering its own preview over `classifyLines`.

Ordered lists **renumber sequentially** from their first item's value, so
`1.` / `1.` renders as 1, 2 (and `3.` / `1.` as 3, 4). The computed number rides
on each ordered `LineBlock` as `seq`. A blank line is transparent within a list;
any other content ends the run so the next list starts fresh.

A line that is just a single `-` renders as a thematic-break divider (alongside
the usual `---`) — a quick "type a dash, get a line" shorthand. A `- ` with text
after it is still a bullet.

## Adapting to your app

A new app's needs won't match the editor exactly. The common mismatches:

- **You want fewer affordances.** The editor is already minimal — there's no
  toolbar to hide. To make it read-only, render `RenderedLine` over
  `classifyLines(body)` yourself instead of mounting the editor.
- **You need a title field above the body.** Keep the title as your own input and
  hand focus down with the `ref`: on Enter / ArrowDown in the title, call
  `editorRef.current?.focus()` to drop the caret at the top-or-end of the body.
  Pass `focusOnMount={false}` so a freshly opened document keeps the keyboard
  down until the user taps (mobile) or your title field has focus.
- **You want a narrower writing column.** Set `maxWidth` (e.g. `"42rem"`); the
  column centres itself. Leave it `"none"` for edge-to-edge.
- **Renamed / different theme tokens.** The editor reads the framework's token
  names. If your app's palette uses different variable names, map them in CSS
  (`--color-fg: var(--my-text)`) or adopt the framework theme.
- **Live collaboration / external updates.** Feeding a new `body` while the
  editor is open adopts it without disturbing in-progress typing (the editor
  diffs against its own last value and clamps the caret). Push external edits in
  through `body` rather than remounting.
- **Different storage shape.** The editor is storage-agnostic — it only knows the
  `body` string. Persist on `onChange` (debounced, to localStorage, to a synced
  file, wherever); the editor never touches your store.

## Verification

- The whole document renders formatted; clicking a line turns _that line_ into
  raw source and leaves the rest formatted.
- Enter splits a line, Backspace at column 0 merges into the line above, and the
  arrow keys glide the caret across lines natively (it's one editable surface).
- Selecting across lines and copying (or cutting) puts the verbatim Markdown
  (and full URLs) on the clipboard, not the rendered text; Ctrl/Cmd+A selects
  the whole document.
- Switching documents (`key` change) starts clean rather than carrying the prior
  caret/active line.
