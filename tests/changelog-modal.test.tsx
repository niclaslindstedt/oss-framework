// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildFeatureDocs,
  ChangelogModal,
  parseChangelog,
} from "../src/changelog/index.ts";

const RELEASES = parseChangelog(
  [
    "## [0.2.0] - 2026-06-18",
    "",
    "### Added",
    "",
    "- A themed feature. [Learn more](feature:theming)",
    "",
    "### Fixed",
    "",
    "- A `code`-flavoured **bold** bug.",
    "",
    "## [0.1.0] - 2026-01-01",
    "",
    "### Added",
    "",
    "- Initial scaffold.",
  ].join("\n"),
);

const FEATURE_DOCS = buildFeatureDocs({
  "./docs/features/theming.md":
    "# Theming\n\nThemes project onto CSS variables.",
});

afterEach(() => {
  document.body.style.overflow = "";
});

describe("ChangelogModal", () => {
  it("renders the release list newest-first", () => {
    render(<ChangelogModal open onClose={vi.fn()} releases={RELEASES} />);
    expect(screen.getByRole("heading", { name: "Changelog" })).toBeTruthy();
    expect(screen.getByText("0.2.0")).toBeTruthy();
    expect(screen.getByText("0.1.0")).toBeTruthy();
  });

  it("drills into a feature doc via a Learn more link and back again", () => {
    render(
      <ChangelogModal
        open
        onClose={vi.fn()}
        releases={RELEASES}
        featureDocs={FEATURE_DOCS}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Learn more" }));
    expect(screen.getByRole("heading", { name: "Theming" })).toBeTruthy();
    expect(screen.getByText("Themes project onto CSS variables.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { name: "Changelog" })).toBeTruthy();
  });

  it("renders a feature link as a no-op button when its doc is absent", () => {
    render(<ChangelogModal open onClose={vi.fn()} releases={RELEASES} />);
    // The bullet's `feature:` link still renders as a button (the modal always
    // wires the handler), but with no matching doc, clicking it is a no-op —
    // the list stays put rather than drilling into a dead end.
    fireEvent.click(screen.getByRole("button", { name: "Learn more" }));
    expect(screen.queryByRole("heading", { name: "Theming" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Changelog" })).toBeTruthy();
  });

  it("calls onClose on Escape and on the close button", () => {
    const onClose = vi.fn();
    render(<ChangelogModal open onClose={onClose} releases={RELEASES} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("shows the empty state when there are no releases", () => {
    render(<ChangelogModal open onClose={vi.fn()} releases={[]} />);
    expect(screen.getByText("No releases yet.")).toBeTruthy();
  });

  it("honours injected labels", () => {
    render(
      <ChangelogModal
        open
        onClose={vi.fn()}
        releases={RELEASES}
        labels={{ heading: "Vad är nytt" }}
      />,
    );
    expect(screen.getByRole("heading", { name: "Vad är nytt" })).toBeTruthy();
  });

  it("fills the screen on mobile and shrinks to a centered card from `sm` up", () => {
    render(<ChangelogModal open onClose={vi.fn()} releases={RELEASES} />);
    const dialog = screen.getByRole("dialog");
    // Mobile (default): full height/width, no rounded corners.
    expect(dialog.className).toContain("h-full");
    expect(dialog.className).toContain("max-h-full");
    expect(dialog.className).toContain("w-full");
    // From the `sm` breakpoint up: the centered, capped card returns.
    expect(dialog.className).toContain("sm:max-h-[85vh]");
    expect(dialog.className).toContain("sm:max-w-md");
    expect(dialog.className).toContain("sm:rounded-md");
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <ChangelogModal open={false} onClose={vi.fn()} releases={RELEASES} />,
    );
    expect(container.childElementCount).toBe(0);
    // Portalled content lives on document.body, not the container — assert the
    // dialog is absent there too.
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
