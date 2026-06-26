// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useState } from "react";

import {
  Sidebar,
  type MenuButtonPosition,
} from "@niclaslindstedt/oss-framework/sidebar";

// Demonstrates the navigation shell both ways: a `pinned` toggle flips between
// the docked permanent sidebar and the floating-button drawer, and a side
// toggle moves the resting edge. The rows inside are the demo's own content —
// the framework owns only the framing around them. The floating button and
// drawer are `position: fixed`, so they overlay the whole preview page.

const NAV_ITEMS = ["Inbox", "Today", "Upcoming", "Archive", "Settings"];

function NavRows({ onPick }: { onPick: () => void }) {
  return (
    <div className="flex flex-1 flex-col py-2">
      <p className="px-5 py-2 text-xs font-bold tracking-wide text-muted uppercase">
        Sections
      </p>
      {NAV_ITEMS.map((item) => (
        <button
          key={item}
          type="button"
          onClick={onPick}
          className="flex w-full cursor-pointer items-center px-5 py-[var(--density-row-py)] text-left text-sm text-fg hover:bg-surface-2 hover:text-fg-bright"
        >
          {item}
        </button>
      ))}
    </div>
  );
}

export function SidebarDemo() {
  const [pinned, setPinned] = useState(false);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuButtonPosition>({
    side: "left",
    y: 0.5,
  });

  const flipSide = () =>
    setPosition((p) => ({ ...p, side: p.side === "left" ? "right" : "left" }));

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-bold text-fg-bright">Sidebar</h2>
        <p className="text-sm text-muted">
          The responsive navigation shell — docked when <code>pinned</code>, a
          draggable floating button and drawer otherwise. Drag the button to
          either edge; the drawer slides in from its resting side.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setPinned((v) => !v)}
          className="cursor-pointer rounded border border-line bg-surface-2 px-3 py-1.5 text-sm text-fg hover:bg-surface-3"
        >
          {pinned ? "Unpin (drawer)" : "Pin (dock)"}
        </button>
        <button
          type="button"
          onClick={flipSide}
          className="cursor-pointer rounded border border-line bg-surface-2 px-3 py-1.5 text-sm text-fg hover:bg-surface-3"
        >
          Side: {position.side}
        </button>
      </div>

      {/* The docked variant lays out as a flex sibling of the content; the
          drawer variant overlays the viewport, so the framed row below just
          previews the docked case. */}
      <div className="flex h-72 overflow-hidden rounded-md border border-line">
        <Sidebar
          pinned={pinned}
          open={open}
          onToggle={() => setOpen((v) => !v)}
          onClose={() => setOpen(false)}
          position={position}
          onPositionChange={setPosition}
          swipeToClose
        >
          <NavRows onPick={() => setOpen(false)} />
        </Sidebar>
        <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted">
          {pinned
            ? "Docked sidebar sits beside this content."
            : "Tap the floating button to open the drawer."}
        </div>
      </div>
    </section>
  );
}
