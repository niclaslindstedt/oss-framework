// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useRef, useState, type RefObject } from "react";

// Drag-and-drop file intake: watch a target (the window, or an element via
// `targetRef`) for a file drag, expose an `active` flag the caller renders an
// overlay from, and deliver the dropped `File`s to `onDrop`.
//
// The mechanics that are easy to get subtly wrong live here:
//
// - **Depth-counted enter/leave.** `dragenter` / `dragleave` fire for every
//   child element the pointer crosses, so a bare boolean would flicker the
//   overlay. A counter keeps `active` up until the drag truly leaves.
// - **`preventDefault` on over/drop.** Without it the browser navigates to
//   (or opens) the dropped file instead of handing it to the app.
// - **An `accepts` gate.** The same predicate guards the visual state and the
//   drop, so the overlay never invites a drop the handler would ignore — and
//   an unaccepted drag is left entirely alone (no `preventDefault`), free to
//   bubble to whoever wants it.
//
// **Two zones can coexist**, one nested inside the other — say a window-level
// intake for one file kind wrapped around an element-level intake for another:
//
//   - give the *inner* zone `targetRef` + `claim: true` and an `accepts` that
//     matches only its kind (e.g. `dragHasFilesOfType(dt, "image/")`);
//   - give the *outer* zone a broader `accepts` (the default `dragHasFiles`).
//
//   The inner zone stops propagation on the drags it accepts, so the outer
//   overlay stays down while the pointer is over the inner target; a drag the
//   inner zone rejects falls straight through to the outer one.
//
// The listeners are attached natively (not as React props), so the hook works
// against the window and against any host element alike; the caller only
// supplies a ref.

export type FileDropOptions = {
  /** Element to watch; the whole window when omitted. */
  targetRef?: RefObject<HTMLElement | null>;
  /**
   * Gate for both the active state and the drop; a rejected drag is left
   * untouched (free to bubble / take the browser default). Defaults to
   * {@link dragHasFiles} — any drag carrying files.
   */
  accepts?: (dt: DataTransfer) => boolean;
  /**
   * Stop propagation on the events this zone accepts, so a nested zone can
   * claim its file kind away from an enclosing zone (see the header comment).
   */
  claim?: boolean;
  /** All the dropped files (the caller filters, e.g. {@link firstFileOfType}). */
  onDrop: (files: File[]) => void;
};

export function useFileDrop({
  targetRef,
  accepts = dragHasFiles,
  claim = false,
  onDrop,
}: FileDropOptions): { active: boolean } {
  const [active, setActive] = useState(false);
  const depth = useRef(0);
  // The latest callbacks live in a ref so the effect (and its listeners)
  // never re-attach just because the caller passed fresh closures.
  const opts = useRef({ accepts, claim, onDrop });
  opts.current = { accepts, claim, onDrop };

  useEffect(() => {
    const target: EventTarget | null = targetRef ? targetRef.current : window;
    if (!target) return;

    // Returns the gate's verdict and, when accepted, claims the event for
    // this zone (stopPropagation) if the caller asked for that.
    const accepted = (e: DragEvent): boolean => {
      const dt = e.dataTransfer;
      if (!dt || !opts.current.accepts(dt)) return false;
      if (opts.current.claim) e.stopPropagation();
      return true;
    };

    const onDragEnter = (e: DragEvent) => {
      if (!accepted(e)) return;
      e.preventDefault();
      depth.current += 1;
      setActive(true);
    };
    const onDragOver = (e: DragEvent) => {
      if (!accepted(e)) return;
      // Signal we accept the drop (without this, the browser opens the file).
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };
    const onDragLeave = (e: DragEvent) => {
      if (!accepted(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setActive(false);
    };
    const onDropEvent = (e: DragEvent) => {
      if (!accepted(e)) return;
      e.preventDefault();
      depth.current = 0;
      setActive(false);
      opts.current.onDrop(filesFromDataTransfer(e.dataTransfer));
    };

    target.addEventListener("dragenter", onDragEnter as EventListener);
    target.addEventListener("dragover", onDragOver as EventListener);
    target.addEventListener("dragleave", onDragLeave as EventListener);
    target.addEventListener("drop", onDropEvent as EventListener);
    return () => {
      target.removeEventListener("dragenter", onDragEnter as EventListener);
      target.removeEventListener("dragover", onDragOver as EventListener);
      target.removeEventListener("dragleave", onDragLeave as EventListener);
      target.removeEventListener("drop", onDropEvent as EventListener);
      depth.current = 0;
    };
  }, [targetRef]);

  return { active };
}

/** Whether a drag carries files (rather than text or an element) — the
 *  default `accepts`, and the signal a drop overlay should show on. */
export function dragHasFiles(dt: DataTransfer | null): boolean {
  if (!dt) return false;
  return Array.from(dt.types ?? []).includes("Files");
}

/** Whether a drag carries at least one file whose MIME type starts with
 *  `mimePrefix` (e.g. `"image/"`). Reads the drag's `items`, which browsers
 *  expose mid-drag; a file of unknown type deliberately does *not* match, so
 *  it falls through to a broader enclosing zone. */
export function dragHasFilesOfType(
  dt: DataTransfer | null,
  mimePrefix: string,
): boolean {
  if (!dt) return false;
  return Array.from(dt.items ?? []).some(
    (it) => it.kind === "file" && it.type.startsWith(mimePrefix),
  );
}

/** The first file whose MIME type starts with `mimePrefix`, or null. On drop
 *  the real types are known, so this is the authoritative post-drop filter. */
export function firstFileOfType<T extends { type: string }>(
  files: readonly T[],
  mimePrefix: string,
): T | null {
  for (const file of files) {
    if (file.type.startsWith(mimePrefix)) return file;
  }
  return null;
}

/** Pull the `File`s off a drop's `DataTransfer`. Prefers the typed `files`
 *  list; falls back to walking `items` (some browsers only populate one). */
export function filesFromDataTransfer(dt: DataTransfer | null): File[] {
  if (!dt) return [];
  if (dt.files && dt.files.length > 0) return Array.from(dt.files);
  const out: File[] = [];
  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind === "file") {
      const f = item.getAsFile();
      if (f) out.push(f);
    }
  }
  return out;
}
