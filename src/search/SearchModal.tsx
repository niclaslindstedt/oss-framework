// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Modal } from "../components/Modal.tsx";
import { CloseIcon, SearchIcon } from "../components/icons.tsx";

// A generic search overlay: a full-screen sheet on mobile, a centred card from
// `sm` up (the framework `Modal` shell). It owns the search field, clears the
// query each time it opens, and renders the empty / no-results / invalid-regex
// states; your app supplies the corpus search and the result rows. The modal is
// generic over the result type `T` — typically a per-group result your app
// builds over the matcher (`compileQuery` / `searchItems`) — so it imports no
// domain types.
//
// The seam: the modal owns the query input and the surrounding chrome; you own
// what gets searched (build and memoise your index app-side) and how each
// result renders (the `children` render prop). Drive selection from your rows,
// calling the `close` argument once a result is picked.

/** What `search` returns for a live query. */
export type SearchResults<T> = {
  /** The top-level results to render (groups, records — whatever your app
   *  surfaces). The "N matches" count reads `results.length`. */
  results: T[];
  /** Set when the query was a `/…/` regex that failed to compile, so the modal
   *  shows the invalid-regex message instead of "no results". */
  invalidRegex?: boolean;
};

/** Visible strings, all overridable. English defaults ship; pass your app's
 *  translations to localise. */
export type SearchModalLabels = {
  /** Accessible dialog title + input aria-label. */
  title: string;
  placeholder: string;
  /** Aria-label / tooltip for the clear-query button. */
  clear: string;
  /** Aria-label for the dismissing backdrop / close button. */
  close: string;
  /** Hero line shown before the user types anything. */
  prompt: string;
  /** Secondary hint under the prompt (e.g. the query-language cheatsheet). */
  hint: string;
  /** Shown when a `/…/` regex query is malformed. */
  invalidRegex: string;
  /** Shown when a non-empty query matched nothing. */
  noResults: (query: string) => string;
  /** The result-count header above the list. */
  matches: (n: number) => string;
};

const DEFAULT_LABELS: SearchModalLabels = {
  title: "Search",
  placeholder: "Search…",
  clear: "Clear",
  close: "Close",
  prompt: "Type to search.",
  hint: "Use * and ? for wildcards, or /regex/ for a pattern.",
  invalidRegex: "Invalid regular expression.",
  noResults: (query) => `No results for “${query}”.`,
  matches: (n) => (n === 1 ? "1 match" : `${n} matches`),
};

type Props<T> = {
  open: boolean;
  onClose: () => void;
  /** Run the live query against your corpus. Called on every keystroke, so
   *  memoise your index app-side and keep this stable (`useCallback`). */
  search: (query: string) => SearchResults<T>;
  /** Render the result list. `close` dismisses the modal — call it from a row
   *  after navigating to the picked result. */
  children: (results: T[], close: () => void) => ReactNode;
  /** Fired with the trimmed query whenever it changes (including ""). Use it
   *  for analytics or an achievement that watches the search gesture. */
  onQueryChange?: (query: string) => void;
  labels?: Partial<SearchModalLabels>;
};

export function SearchModal<T>({
  open,
  onClose,
  search,
  children,
  onQueryChange,
  labels,
}: Props<T>) {
  const l = { ...DEFAULT_LABELS, ...labels };
  const headingId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  const { results, invalidRegex } = useMemo(
    () => search(query),
    [search, query],
  );
  const trimmed = query.trim();

  // Clear any stale query each time the modal opens, so it never reopens onto a
  // previous search. Focus is owned by `Modal` via `initialFocusRef={inputRef}`:
  // it focuses the field in a layout effect, so when the open is dispatched
  // inside `flushSync` from the tap that triggered it, focus lands within the
  // gesture and iOS raises the soft keyboard.
  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  // Notify the host of the live query (the achievement / analytics seam).
  const onQueryChangeRef = useRef(onQueryChange);
  onQueryChangeRef.current = onQueryChange;
  useEffect(() => {
    onQueryChangeRef.current?.(trimmed);
  }, [trimmed]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy={headingId}
      initialFocusRef={inputRef}
      closeLabel={l.close}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-line bg-surface-3 px-3 py-2">
        <span className="pl-1 text-muted">
          <SearchIcon className="h-5 w-5" />
        </span>
        <h2 id={headingId} className="sr-only">
          {l.title}
        </h2>
        <input
          ref={inputRef}
          type="search"
          inputMode="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={l.placeholder}
          aria-label={l.title}
          className="min-w-0 flex-1 border-0 bg-transparent py-1 text-base text-fg-bright outline-none placeholder:text-muted/70 [appearance:none] [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            aria-label={l.clear}
            title={l.clear}
            className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-fg-bright"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label={l.close}
          className="-mr-1 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-fg-bright"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto [overscroll-behavior:contain]">
        {!trimmed ? (
          <div className="px-6 py-10 text-center text-sm text-muted">
            <SearchIcon className="mx-auto mb-3 h-8 w-8 opacity-40" />
            <p>{l.prompt}</p>
            <p className="mx-auto mt-2 max-w-sm text-xs text-muted/80">
              {l.hint}
            </p>
          </div>
        ) : invalidRegex ? (
          <Empty message={l.invalidRegex} />
        ) : results.length === 0 ? (
          <Empty message={l.noResults(trimmed)} />
        ) : (
          <>
            <p className="px-4 pt-3 pb-1 text-xs tracking-wide text-muted uppercase">
              {l.matches(results.length)}
            </p>
            <ul className="m-0 list-none p-0 pb-[env(safe-area-inset-bottom)]">
              {children(results, onClose)}
            </ul>
          </>
        )}
      </div>
    </Modal>
  );
}

function Empty({ message }: { message: string }) {
  return <p className="px-6 py-10 text-center text-sm text-muted">{message}</p>;
}
