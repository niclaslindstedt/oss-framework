// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { CheckIcon, ChevronDownIcon } from "./icons.tsx";
import { FloatingPanel } from "./FloatingPanel.tsx";
import type { FloatingPlacement } from "./useFloatingPosition.ts";
import { matchPrefixRange, useTypeahead } from "../hooks/useTypeahead.ts";

export type SelectOption<T extends string | number> = {
  value: T;
  label: React.ReactNode;
  // Optional secondary line shown under the label in the option list.
  hint?: React.ReactNode;
  // Inline style applied to the option's label (e.g. a font preview).
  labelStyle?: React.CSSProperties;
  // The string type-ahead matches against (see the `typeahead` prop). Defaults
  // to `label` when it's a string; set it when the label is a React node (an
  // icon + text, a styled span) so typing still jumps to this option.
  typeaheadLabel?: string;
  disabled?: boolean;
};

type Props<T extends string | number> = {
  value: T;
  options: SelectOption<T>[];
  onChange: (next: T) => void;
  // Override placement defaults (minimum-width grows to the trigger,
  // left anchor, `document` coordinate space).
  placement?: Partial<FloatingPlacement>;
  // Tailwind classes for the trigger button — defaults to the standard
  // bordered-field look.
  triggerClassName?: string;
  // Tailwind classes for the floating panel (e.g. `max-h-64
  // overflow-y-auto` for long option lists).
  panelClassName?: string;
  // Custom rendering for the trigger's current-value label. Defaults to
  // the selected option's `label`.
  renderValue?: (option: SelectOption<T> | null) => React.ReactNode;
  // Required when no visible label wraps the picker (a settings row
  // usually supplies one via the surrounding field).
  ariaLabel?: string;
  // Type-ahead: while the panel is open, printable keystrokes jump the
  // highlight to the first option whose label starts with what's been typed
  // (the same "type to select" a native `<select>` has), and the matched
  // characters are emphasised on that option. On by default whenever an
  // option exposes a string to match (its `label` or `typeaheadLabel`); pass
  // `false` to switch it off.
  typeahead?: boolean;
  disabled?: boolean;
};

const DEFAULT_PLACEMENT: FloatingPlacement = {
  width: { kind: "min", minPx: 160 },
  anchor: "left",
  coordinateSpace: "document",
};

// Emphasise the characters the active type-ahead query matched on the
// highlighted option. Only string labels can be sliced; a React-node label
// (an icon + text, a styled preview) is left intact — it still navigates by
// `typeaheadLabel`, it just isn't marked.
function renderTypeaheadMatch(
  label: React.ReactNode,
  query: string,
): React.ReactNode {
  if (typeof label !== "string") return label;
  const range = matchPrefixRange(label, query);
  if (!range) return label;
  return (
    <>
      {label.slice(0, range.start)}
      <mark className="rounded-[2px] bg-accent/30 text-fg-bright [font-weight:inherit]">
        {label.slice(range.start, range.end)}
      </mark>
      {label.slice(range.end)}
    </>
  );
}

// Custom <select> replacement built on `FloatingPanel`. The trigger is a
// styled bordered field; the panel is a `role="listbox"` of
// `role="option"` buttons. Full keyboard nav: ArrowUp / Down to move the
// highlight, Home / End to jump, Enter / Space to commit, Escape to
// dismiss without committing.
export function SelectPicker<T extends string | number>({
  value,
  options,
  onChange,
  placement,
  triggerClassName,
  panelClassName,
  renderValue,
  ariaLabel,
  typeahead = true,
  disabled,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState<number>(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const listboxId = useId();

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  );

  // One match-string per option, index-aligned with `options`. An option with
  // no string to match (a node label and no `typeaheadLabel`) gets "" so it's
  // skipped without throwing off the matched index. Type-ahead is live only
  // when at least one option offers something to match.
  const typeaheadLabels = useMemo(
    () =>
      options.map(
        (o) => o.typeaheadLabel ?? (typeof o.label === "string" ? o.label : ""),
      ),
    [options],
  );
  const typeaheadEnabled =
    typeahead && typeaheadLabels.some((l) => l.length > 0);

  // Seed the highlight to the currently selected option each time the
  // panel opens so ArrowDown moves to "the next thing", not back to
  // the top.
  useEffect(() => {
    if (!open) return;
    const idx = options.findIndex((o) => o.value === value);
    setHighlight(idx === -1 ? 0 : idx);
  }, [open, options, value]);

  const {
    onKeyDown: onTypeaheadKey,
    query: typeaheadQuery,
    reset: resetTypeahead,
  } = useTypeahead({
    labels: typeaheadLabels,
    onMatch: (i) => {
      if (!options[i]?.disabled) setHighlight(i);
    },
  });

  const close = useCallback(() => {
    setOpen(false);
    setHighlight(-1);
    resetTypeahead();
  }, [resetTypeahead]);

  // Keep the highlighted option scrolled into view — both arrow/Home/End
  // moves and type-ahead jumps can land on a row below the panel's fold.
  useEffect(() => {
    if (!open || highlight < 0) return;
    optionRefs.current[highlight]?.scrollIntoView?.({ block: "nearest" });
  }, [open, highlight]);

  const commit = useCallback(
    (option: SelectOption<T>) => {
      if (option.disabled) return;
      onChange(option.value);
      close();
      triggerRef.current?.focus();
    },
    [onChange, close],
  );

  const moveHighlight = useCallback(
    (delta: number) => {
      if (options.length === 0) return;
      setHighlight((prev) => {
        const start = prev === -1 ? 0 : prev;
        let next = start;
        for (let i = 0; i < options.length; i++) {
          next = (next + delta + options.length) % options.length;
          if (!options[next]?.disabled) return next;
        }
        return prev;
      });
    },
    [options],
  );

  function handleTriggerKey(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (
      e.key === "ArrowDown" ||
      e.key === "ArrowUp" ||
      e.key === "Enter" ||
      e.key === " "
    ) {
      e.preventDefault();
      setOpen(true);
    }
  }

  function handleListKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      resetTypeahead();
      moveHighlight(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      resetTypeahead();
      moveHighlight(-1);
    } else if (e.key === "Home") {
      e.preventDefault();
      resetTypeahead();
      const i = options.findIndex((o) => !o.disabled);
      if (i !== -1) setHighlight(i);
    } else if (e.key === "End") {
      e.preventDefault();
      resetTypeahead();
      for (let i = options.length - 1; i >= 0; i--) {
        if (!options[i]?.disabled) {
          setHighlight(i);
          break;
        }
      }
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const option = options[highlight];
      if (option) commit(option);
    } else if (typeaheadEnabled) {
      // Printable keys jump the highlight to the first matching option; the
      // hook ignores everything it shouldn't consume (Tab, Escape, …).
      onTypeaheadKey(e);
    }
  }

  const triggerClasses =
    triggerClassName ??
    "flex w-full cursor-pointer items-center gap-2 rounded-md border border-line bg-surface-2 px-2.5 py-1.5 text-left text-sm text-fg hover:border-accent focus-visible:border-accent focus-visible:outline-none";

  const finalPlacement: FloatingPlacement = {
    ...DEFAULT_PLACEMENT,
    ...placement,
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={handleTriggerKey}
        className={`${triggerClasses} ${disabled ? "cursor-not-allowed opacity-60" : ""}`.trim()}
      >
        <span className="flex-1 truncate">
          {renderValue ? renderValue(selected) : (selected?.label ?? "")}
        </span>
        <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-muted" />
      </button>

      <FloatingPanel
        open={open && !disabled}
        onClose={close}
        triggerRef={triggerRef}
        placement={finalPlacement}
        className={`py-1 ${panelClassName ?? ""}`.trim()}
      >
        <div
          id={listboxId}
          role="listbox"
          tabIndex={-1}
          onKeyDown={handleListKey}
          // Auto-focus the listbox when it opens so keyboard nav works
          // without an extra click.
          ref={(el) => {
            if (el && open) el.focus();
          }}
          className="outline-none"
        >
          {options.map((option, i) => {
            const isSelected = option.value === value;
            const isHighlighted = i === highlight;
            return (
              <button
                key={String(option.value)}
                ref={(el) => {
                  optionRefs.current[i] = el;
                }}
                type="button"
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled || undefined}
                disabled={option.disabled}
                onMouseEnter={() => !option.disabled && setHighlight(i)}
                onClick={() => commit(option)}
                className={`flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-3 py-2 text-left text-sm text-fg ${
                  option.disabled
                    ? "cursor-not-allowed opacity-50"
                    : isHighlighted
                      ? "bg-surface-3 text-fg-bright"
                      : "hover:bg-surface-3"
                }`}
              >
                <span className="flex flex-1 flex-col gap-0.5 truncate">
                  <span className="truncate" style={option.labelStyle}>
                    {isHighlighted && typeaheadQuery
                      ? renderTypeaheadMatch(option.label, typeaheadQuery)
                      : option.label}
                  </span>
                  {option.hint && (
                    <span className="truncate text-xs text-muted">
                      {option.hint}
                    </span>
                  )}
                </span>
                {isSelected && (
                  <CheckIcon className="h-3.5 w-3.5 shrink-0 text-accent" />
                )}
              </button>
            );
          })}
        </div>
      </FloatingPanel>
    </>
  );
}
