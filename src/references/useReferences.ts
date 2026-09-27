// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useState } from "react";

import { referenceList, type Reference, type Registry } from "./registry.ts";

// The registry, loaded once and shared. It is read by one screen a user opens
// now and then, so it belongs in its own chunk — bundled with the app, never
// fetched from anywhere else (OSS_SPEC.md §24.4) — and lands a beat after the
// screen opens. The loader is the app's: typically
//
//   const loadRegistry = () =>
//     import("../docs/references.json").then((m) => m.default as Registry<Topic>);
//
// declared once at module level. The cache is keyed by that function, so an
// inline arrow (a new function each render) would load on every mount.

type Loader<Topic extends string> = () => Promise<Registry<Topic>>;

const loaded = new WeakMap<Loader<string>, Reference<string>[]>();
const pending = new WeakMap<Loader<string>, Promise<Reference<string>[]>>();

/** Load and rank the registry behind `load`, once per loader. A failed load is
 *  forgotten, so the next call tries again. */
export function loadReferences<Topic extends string>(
  load: Loader<Topic>,
): Promise<Reference<Topic>[]> {
  const key = load as Loader<string>;
  let promise = pending.get(key);
  if (!promise) {
    promise = load().then(
      (registry) => {
        const refs = referenceList(registry);
        loaded.set(key, refs);
        return refs;
      },
      (error: unknown) => {
        pending.delete(key);
        throw error;
      },
    );
    pending.set(key, promise);
  }
  return promise as Promise<Reference<Topic>[]>;
}

/** Every reference behind `load`, strongest evidence first — or `null` until
 *  the chunk has landed (and while a failed load has nothing to show). Pass a
 *  module-level function; see above. */
export function useReferences<Topic extends string>(
  load: Loader<Topic>,
): Reference<Topic>[] | null {
  const [refs, setRefs] = useState<Reference<Topic>[] | null>(
    () => (loaded.get(load as Loader<string>) as Reference<Topic>[]) ?? null,
  );
  useEffect(() => {
    if (refs) return;
    let cancelled = false;
    loadReferences(load).then(
      (r) => {
        if (!cancelled) setRefs(r);
      },
      () => {
        // Left at `null`: the screen keeps its loading line, and the next
        // mount tries again.
      },
    );
    return () => {
      cancelled = true;
    };
  }, [load, refs]);
  return refs;
}
