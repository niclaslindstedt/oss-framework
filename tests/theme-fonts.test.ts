// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

// Each case needs a module registry of its own: the loader registry and the
// "already started" memo are module state by design.
async function freshFonts() {
  vi.resetModules();
  return await import("../src/theme/fonts.ts");
}

describe("font loaders", () => {
  it("resolves to a no-op for the bundled default family", async () => {
    const { loadFontFamily, registerFontLoaders } = await freshFonts();
    const sans = vi.fn(async () => {});
    registerFontLoaders({ sans });
    await loadFontFamily("mono");
    expect(sans).not.toHaveBeenCalled();
  });

  it("resolves — rather than failing — for a family nobody registered", async () => {
    const { loadFontFamily, loadableFontFamilies } = await freshFonts();
    expect(loadableFontFamilies()).toEqual([]);
    await expect(loadFontFamily("serif")).resolves.toBeUndefined();
  });

  it("runs a registered loader once, however often the family is asked for", async () => {
    const { loadFontFamily, registerFontLoaders } = await freshFonts();
    const sans = vi.fn(async () => "loaded");
    registerFontLoaders({ sans });
    const [a, b] = await Promise.all([
      loadFontFamily("sans"),
      loadFontFamily("sans"),
    ]);
    await loadFontFamily("sans");
    expect(sans).toHaveBeenCalledOnce();
    expect(a).toBe("loaded");
    expect(b).toBe("loaded");
  });

  it("merges later registrations instead of replacing them", async () => {
    const { registerFontLoaders, loadableFontFamilies } = await freshFonts();
    registerFontLoaders({ sans: async () => {} });
    registerFontLoaders({ serif: async () => {} });
    expect(loadableFontFamilies().sort()).toEqual(["sans", "serif"]);
  });

  it("lets a later registration replace a family's loader", async () => {
    const { registerFontLoaders, loadFontFamily } = await freshFonts();
    const first = vi.fn(async () => {});
    const second = vi.fn(async () => {});
    registerFontLoaders({ sans: first });
    registerFontLoaders({ sans: second });
    await loadFontFamily("sans");
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });

  it("kicks off every registered family for the picker's previews", async () => {
    const { registerFontLoaders, loadAllFontFamilies } = await freshFonts();
    const sans = vi.fn(async () => {});
    const dyslexic = vi.fn(async () => {});
    registerFontLoaders({ sans, dyslexic });
    loadAllFontFamilies();
    expect(sans).toHaveBeenCalledOnce();
    expect(dyslexic).toHaveBeenCalledOnce();
  });
});
