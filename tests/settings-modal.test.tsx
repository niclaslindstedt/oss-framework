// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_THEME_APPEARANCE,
  SettingsModal,
  type ThemeAppearance,
} from "../src/theme/index.ts";

afterEach(() => {
  document.body.style.overflow = "";
});

function renderModal(
  overrides: Partial<React.ComponentProps<typeof SettingsModal>> = {},
) {
  const onChange = vi.fn();
  const onClose = vi.fn();
  const utils = render(
    <SettingsModal
      open
      onClose={onClose}
      appearance={DEFAULT_THEME_APPEARANCE}
      onChange={onChange}
      {...overrides}
    />,
  );
  return { onChange, onClose, ...utils };
}

describe("SettingsModal", () => {
  it("renders the dialog with the theme and font sections", () => {
    renderModal();
    expect(screen.getByRole("heading", { name: "Settings" })).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Theme")).toBeTruthy();
    expect(screen.getByText("Text size")).toBeTruthy();
  });

  it("switches the theme mode via onChange", () => {
    const { onChange } = renderModal();
    fireEvent.click(screen.getByRole("radio", { name: "Light" }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ theme: "githubLight" }),
    );
  });

  it("seeds the custom theme when switching into Custom", () => {
    const { onChange } = renderModal();
    fireEvent.click(screen.getByRole("radio", { name: "Custom" }));
    const next = onChange.mock.calls[0]?.[0] as ThemeAppearance;
    expect(next.theme).toBe("custom");
    // The seed copies the on-screen theme's colours into the custom controls.
    expect(typeof next.customTheme.colors.accent).toBe("string");
  });

  it("shows the shape and component sections on every theme", () => {
    renderModal();
    expect(screen.getByText("Shape & motion")).toBeTruthy();
    expect(screen.getByText("Components")).toBeTruthy();
  });

  it("reveals the colour section only in Custom mode", () => {
    const custom: ThemeAppearance = {
      ...DEFAULT_THEME_APPEARANCE,
      theme: "custom",
    };
    renderModal({ appearance: custom });
    expect(screen.getByText("Colours")).toBeTruthy();
  });

  it("hides the colour section outside Custom mode", () => {
    renderModal();
    expect(screen.queryByText("Colours")).toBeNull();
  });

  it("resets to the default appearance from the footer", () => {
    const custom: ThemeAppearance = {
      ...DEFAULT_THEME_APPEARANCE,
      theme: "githubLight",
      fontScale: 1.25,
    };
    const { onChange } = renderModal({ appearance: custom });
    fireEvent.click(screen.getByRole("button", { name: "Reset to defaults" }));
    expect(onChange).toHaveBeenCalledWith(DEFAULT_THEME_APPEARANCE);
  });

  it("hides the reset button when onReset is null", () => {
    renderModal({ onReset: null });
    expect(
      screen.queryByRole("button", { name: "Reset to defaults" }),
    ).toBeNull();
  });

  it("calls onClose on Escape and on the close button", () => {
    const { onClose } = renderModal();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("honours injected labels", () => {
    renderModal({ labels: { title: "Inställningar", theme: "Tema" } });
    expect(screen.getByRole("heading", { name: "Inställningar" })).toBeTruthy();
    expect(screen.getByText("Tema")).toBeTruthy();
  });

  it("renders nothing when closed", () => {
    const { container } = renderModal({ open: false });
    expect(container.childElementCount).toBe(0);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
