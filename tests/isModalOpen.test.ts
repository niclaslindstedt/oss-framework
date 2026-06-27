// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { afterEach, describe, expect, it } from "vitest";

import { isModalOpen } from "../src/hooks/isModalOpen.ts";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("isModalOpen", () => {
  it("is false when no modal marker is mounted", () => {
    expect(isModalOpen()).toBe(false);
  });

  it('is true while an `[aria-modal="true"]` element is mounted', () => {
    const dialog = document.createElement("div");
    dialog.setAttribute("aria-modal", "true");
    document.body.appendChild(dialog);

    expect(isModalOpen()).toBe(true);
  });

  it("reads the live DOM each call — flips back when the modal unmounts", () => {
    const dialog = document.createElement("div");
    dialog.setAttribute("aria-modal", "true");
    document.body.appendChild(dialog);
    expect(isModalOpen()).toBe(true);

    dialog.remove();
    expect(isModalOpen()).toBe(false);
  });

  it('ignores a non-modal marker (`aria-modal="false"`)', () => {
    const region = document.createElement("div");
    region.setAttribute("aria-modal", "false");
    document.body.appendChild(region);

    expect(isModalOpen()).toBe(false);
  });

  it("is true when any one of several dialogs carries the marker", () => {
    const plain = document.createElement("div");
    const dialog = document.createElement("div");
    dialog.setAttribute("aria-modal", "true");
    document.body.append(plain, dialog);

    expect(isModalOpen()).toBe(true);
  });
});
