// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The live-preview Markdown editor — an Obsidian-style editor that renders the
// document as formatted Markdown and rolls a single raw-source textarea onto
// whichever line the caret sits on. The `MarkdownEditor` component is the whole
// widget; `markdown.ts` is the pure, DOM-free parser an app can reuse on its
// own (classify lines, parse inline spans, shorten URLs). The store stays in
// your app: the editor is controlled (`body` + `onChange`), carrying no
// persistence, no i18n, and no domain types.

export {
  MarkdownEditor,
  type MarkdownEditorHandle,
  type MarkdownEditorLabels,
} from "./MarkdownEditor.tsx";
export { RenderedLine } from "./MarkdownLine.tsx";
export { lineTextClass } from "./markdown-line-class.ts";
export {
  classifyLines,
  parseInline,
  shortenUrl,
  type BlockKind,
  type LineBlock,
  type InlineNode,
} from "./markdown.ts";
export {
  sourcePointFromDom,
  extractSourceRange,
  type SourcePoint,
} from "./markdown-selection.ts";
