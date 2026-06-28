// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { memo, type ReactNode } from "react";

import {
  parseInline,
  shortenUrl,
  type InlineNode,
  type LineBlock,
} from "./markdown.ts";
import { lineTextClass } from "./markdown-line-class.ts";

// Presentational rendering for the live-preview editor: turns a parsed
// `LineBlock` into the formatted React it shows on every line the caret is
// *not* on. Leaf inline nodes carry their source-column `offset` through to a
// `data-src` attribute so the editor can map a click on rendered text back to
// a caret position in the raw source (see `MarkdownEditor.tsx`).

// Whether an image/link href is a real, loadable URL — anything the browser
// can resolve on its own (`http(s):`, `data:`, `blob:`, a protocol-relative or
// root-relative path). A bare or app-relative reference (`attachments/x.png`)
// isn't, so it stays visible as raw `![…](…)` markdown rather than rendering as
// a broken image — the app that wants to resolve such references can layer that
// on with its own renderer.
function isLoadableUrl(href: string): boolean {
  return /^(https?:|data:|blob:|\/\/|\/)/i.test(href);
}

function renderInline(
  nodes: InlineNode[],
  shortenLinkChars: number,
): ReactNode[] {
  return nodes.map((node, i) => {
    switch (node.type) {
      case "text":
        return (
          <span key={i} data-src={node.offset}>
            {node.text}
          </span>
        );
      case "code":
        return (
          <code
            key={i}
            data-src={node.offset}
            className="rounded bg-surface-2 px-1 py-0.5 text-[0.9em] text-fg-bright"
          >
            {node.text}
          </code>
        );
      case "link":
        return (
          <LinkNode
            key={i}
            text={node.text}
            href={node.href}
            offset={node.offset}
            bare={node.bare === true}
            // A bare URL may be trimmed for display; an explicit link's label
            // is the user's own text and is always shown verbatim.
            display={node.bare ? shortenUrl(node.text, shortenLinkChars) : null}
          />
        );
      case "image":
        return (
          <ImageNode
            key={i}
            alt={node.alt}
            href={node.href}
            offset={node.offset}
          />
        );
      case "strong":
        return (
          <strong key={i} className="font-bold text-fg-bright">
            {renderInline(node.children, shortenLinkChars)}
          </strong>
        );
      case "em":
        return <em key={i}>{renderInline(node.children, shortenLinkChars)}</em>;
      case "strikethrough":
        return (
          <s key={i} className="text-muted">
            {renderInline(node.children, shortenLinkChars)}
          </s>
        );
    }
  });
}

// An image reference. When its href is a loadable URL, render the image inline;
// otherwise fall back to the raw markdown text so a stray or app-relative
// `![…](…)` stays visible and editable rather than rendering broken.
function ImageNode({
  alt,
  href,
  offset,
}: {
  alt: string;
  href: string;
  offset: number;
}) {
  if (!isLoadableUrl(href)) {
    return <span data-src={offset}>{`![${alt}](${href})`}</span>;
  }
  return (
    <img
      data-src={offset}
      src={href}
      alt={alt}
      draggable={false}
      onMouseDown={(e) => e.stopPropagation()}
      className="my-1 max-h-80 max-w-full rounded border border-line"
    />
  );
}

// A link node — an ordinary hyperlink when its href is loadable, otherwise the
// raw `[…](…)` markdown (so an app-relative reference stays editable rather than
// rendering as a broken relative link). Stops the editor's line-level mousedown
// so a click follows the link instead of rolling the caret onto its line.
function LinkNode({
  text,
  href,
  offset,
  bare,
  display,
}: {
  text: string;
  href: string;
  offset: number;
  // Whether this is a bare autolinked URL (its rendered text is the source) as
  // opposed to an explicit `[label](url)` whose rendered text is the label.
  bare: boolean;
  // The text to render in place of `text` — a shortened bare URL, or null to
  // show the source verbatim. The href and `data-src` keep the full URL.
  display: string | null;
}) {
  if (!isLoadableUrl(href)) {
    return <span data-src={offset}>{`[${text}](${href})`}</span>;
  }
  return (
    <a
      data-src={offset}
      // A bare URL's display may be shortened, so its source length differs from
      // the rendered text — `data-len` lets a selection map the end of the link
      // back to the end of the full URL in the source (see `markdown-selection`).
      data-len={bare ? text.length : undefined}
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      // Links are draggable by default, which would start a link drag-and-drop
      // instead of a text selection when the user drags across the note.
      draggable={false}
      onMouseDown={(e) => e.stopPropagation()}
      className="text-link underline underline-offset-2"
    >
      {display ?? text}
    </a>
  );
}

// Inline content, falling back to a non-breaking space so an empty line keeps
// a full line-box (and stays clickable to place the caret there).
function inlineContent(block: LineBlock, shortenLinkChars: number): ReactNode {
  if (block.content.length === 0) {
    return <span data-src={block.contentStart}> </span>;
  }
  return renderInline(
    parseInline(block.content, block.contentStart),
    shortenLinkChars,
  );
}

/** Render one source line as its formatted Markdown. */
function RenderedLineImpl({
  block,
  shortenLinkChars = 0,
}: {
  block: LineBlock;
  /** Trim bare URLs to this many characters either side (0 = show in full). */
  shortenLinkChars?: number;
}) {
  const sizeClass = lineTextClass(block);

  switch (block.kind) {
    case "blank":
      return <div className="whitespace-pre-wrap"> </div>;

    case "hr":
      return (
        <div className="flex items-center" data-src={block.contentStart}>
          <hr className="my-[0.6em] w-full border-t border-line" />
        </div>
      );

    case "heading":
      return (
        <div className={sizeClass}>
          {inlineContent(block, shortenLinkChars)}
        </div>
      );

    case "quote":
      return (
        <div className="border-l-2 border-line pl-3 text-muted italic">
          {inlineContent(block, shortenLinkChars)}
        </div>
      );

    case "ul":
      return (
        <div className="flex gap-2">
          <span aria-hidden className="text-accent select-none">
            •
          </span>
          <span className="min-w-0 flex-1">
            {inlineContent(block, shortenLinkChars)}
          </span>
        </div>
      );

    case "ol":
      return (
        <div className="flex gap-2">
          <span aria-hidden className="text-accent tabular-nums select-none">
            {block.ordinal}
          </span>
          <span className="min-w-0 flex-1">
            {inlineContent(block, shortenLinkChars)}
          </span>
        </div>
      );

    case "fence":
    case "code":
      return (
        <div className={`${sizeClass} text-muted`} data-src={0}>
          {block.raw.length === 0 ? " " : block.raw}
        </div>
      );

    case "paragraph":
      return <div>{inlineContent(block, shortenLinkChars)}</div>;
  }
}

// The live editor re-derives `classifyLines(body)` on *every keystroke*, handing
// each rendered line a brand-new `LineBlock` object — so reference equality never
// holds and an un-memoized line would re-run `parseInline` and rebuild its whole
// subtree on every character, for every line in the note. Only the caret's line
// actually changes per keystroke (and it renders as a raw textarea, not here), so
// comparing the block's primitive fields lets every untouched line bail out of the
// re-render: the per-keystroke cost drops from O(lines) to O(1).
export const RenderedLine = memo(
  RenderedLineImpl,
  (a, b) =>
    a.shortenLinkChars === b.shortenLinkChars &&
    a.block.kind === b.block.kind &&
    a.block.raw === b.block.raw &&
    a.block.content === b.block.content &&
    a.block.contentStart === b.block.contentStart &&
    a.block.level === b.block.level &&
    a.block.ordinal === b.block.ordinal,
);
