// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Bring a freshly-focused element into view *after* the soft keyboard has taken
// its space.
//
// On mobile the browser runs its native "reveal the focused field" pass at
// focus time — before the on-screen keyboard finishes animating in and
// shrinking the visual viewport. An element that sits low on screen is still
// fully visible at that instant, so nothing scrolls; the keyboard then slides up
// and covers it.
//
// Re-run the scroll once the viewport has actually shrunk: wait for the next
// `visualViewport` resize (the keyboard settling), then centre the element in
// its scroll container. A timeout backstops platforms that fire no resize
// (desktop focus, or a focus that opens no keyboard — where the element is
// already on screen and centring is harmless).
export function scrollFocusedIntoView(el: HTMLElement): void {
  const reveal = () => {
    if (el.isConnected) el.scrollIntoView({ block: "center" });
  };

  const vv = window.visualViewport;
  if (!vv) {
    reveal();
    return;
  }

  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    vv.removeEventListener("resize", run);
    reveal();
  };
  vv.addEventListener("resize", run);
  window.setTimeout(run, 350);
}
