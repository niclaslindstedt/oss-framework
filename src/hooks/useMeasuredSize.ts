// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useRef, useState, type RefObject } from "react";

// Observe an element's rendered size. `size` is `null` until the first
// measurement lands (the same "null until measured" convention as
// `useFloatingPosition`), then tracks resizes via ResizeObserver. Values are
// rounded to whole pixels so sub-pixel layout wobble doesn't re-render
// consumers. Where ResizeObserver doesn't exist (older jsdom), it degrades to
// a single mount-time measurement rather than throwing.

export type MeasuredSize = { width: number; height: number };

export function useMeasuredSize<T extends Element = HTMLDivElement>(): {
  ref: RefObject<T | null>;
  size: MeasuredSize | null;
} {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState<MeasuredSize | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = (w: number, h: number) => {
      const width = Math.round(w);
      const height = Math.round(h);
      setSize((prev) =>
        prev && prev.width === width && prev.height === height
          ? prev
          : { width, height },
      );
    };
    if (typeof ResizeObserver === "undefined") {
      const rect = el.getBoundingClientRect();
      update(rect.width, rect.height);
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (entry) update(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, size };
}
