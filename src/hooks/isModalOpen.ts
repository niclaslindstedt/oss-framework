// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

// The DOM marker every framework dialog carries: `Modal`, `SettingsModal`, and
// `ChangelogModal` all render `aria-modal="true"` on their focus-trapped
// surface. Global, document-level gestures and keyboard shortcuts probe for it
// to stand down while a dialog owns the screen — a downward pull mustn't
// refresh the chrome behind a modal, an edge swipe mustn't reopen the drawer
// over one, and a stray Cmd/Ctrl+Z mustn't reach through to mutate the document
// beneath it.
const MODAL_SELECTOR = '[aria-modal="true"]';

// True while any framework modal (`[aria-modal="true"]`) is mounted. Call it
// imperatively at event time — per touch, per chord — so it reflects the live
// DOM when the gesture fires, not whatever was open at mount.
//
// Single source of truth for "is a dialog gating the screen?": every global
// gesture / shortcut hook the framework ships calls this to suppress itself
// while a modal is open, and an adopter writing their own document-level
// gesture can call it too instead of re-deriving the probe. Honouring a new
// marker later (say, `inert` containers, or a second attribute) is then a
// one-line change here rather than a hunt across every call site.
export function isModalOpen(): boolean {
  return document.querySelector(MODAL_SELECTOR) !== null;
}
