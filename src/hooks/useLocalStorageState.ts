// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

// `useState` that survives a reload: reads `localStorage` once on mount and
// writes the value back on every change. Owns the fiddly parts every app
// otherwise re-implements around its persisted slices — the try/catch around
// a blocked or full storage, the JSON round-trip, and merging a stored
// partial over the current defaults so a settings object gains new fields
// across app versions without wiping what the user already chose.
//
// The app still owns the seam that matters: *which* key, *what* shape lives
// under it, and that localStorage is the right home for it at all. The hook
// is only the mechanic. State is the source of truth — storage is
// write-through, never read after mount — and the key is expected to stay
// stable for the lifetime of the component.
//
// Defaults handle the JSON case: parse errors and a missing key fall back to
// `defaults`, and when both the stored value and `defaults` are plain
// objects the stored partial is spread over `defaults`. Anything that isn't
// stored as JSON — a raw string, a bespoke serial format — overrides
// `parse` / `serialize` instead.
export type LocalStorageStateOptions<T> = {
  // Turn the raw stored string into state. Runs once, on mount, only when
  // the key exists; throwing falls back to `defaults`. Default: `JSON.parse`,
  // then a shallow merge over `defaults` when both are plain objects.
  parse?: (raw: string, defaults: T) => T;
  // Turn state into the stored string. Default: `JSON.stringify`.
  serialize?: (value: T) => string;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function defaultParse<T>(raw: string, defaults: T): T {
  const parsed = JSON.parse(raw) as unknown;
  if (isPlainObject(defaults) && isPlainObject(parsed)) {
    return { ...defaults, ...parsed } as T;
  }
  return parsed as T;
}

export function useLocalStorageState<T>(
  key: string,
  defaults: T,
  options?: LocalStorageStateOptions<T>,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      if (typeof localStorage === "undefined") return defaults;
      const raw = localStorage.getItem(key);
      if (raw === null) return defaults;
      return (options?.parse ?? defaultParse)(raw, defaults);
    } catch {
      // Corrupt payload or storage blocked — boot from the defaults.
      return defaults;
    }
  });

  // Latest-ref so an inline `serialize` lambda doesn't re-run the effect.
  const serializeRef = useRef(options?.serialize);
  serializeRef.current = options?.serialize;

  useEffect(() => {
    try {
      const serialize = serializeRef.current ?? JSON.stringify;
      localStorage.setItem(key, serialize(value));
    } catch {
      // Storage full or unavailable — the in-memory state still works; the
      // value just won't survive a reload.
    }
  }, [key, value]);

  return [value, setValue];
}
