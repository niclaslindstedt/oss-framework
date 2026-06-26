// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

// The release tooling under scripts/release/ is dogfooded by this repo's own
// release workflow. The bump policy is the part with real branching, so pin it
// down here — the pure helpers are exported precisely so it can be tested
// without touching the filesystem.
import {
  computeBump,
  fragmentLevel,
} from "../scripts/release/compute-bump.mjs";

const frag = (type: string, breaking = false) => ({
  type,
  front: breaking ? { breaking: "true" } : {},
});

describe("fragmentLevel", () => {
  it("maps each type to its lowest implied bump", () => {
    expect(fragmentLevel(frag("Added"))).toBe("minor");
    expect(fragmentLevel(frag("Changed"))).toBe("minor");
    expect(fragmentLevel(frag("Removed"))).toBe("minor");
    expect(fragmentLevel(frag("Deprecated"))).toBe("minor");
    expect(fragmentLevel(frag("Fixed"))).toBe("patch");
    expect(fragmentLevel(frag("Security"))).toBe("patch");
  });

  it("escalates any breaking fragment to major regardless of type", () => {
    expect(fragmentLevel(frag("Fixed", true))).toBe("major");
    expect(fragmentLevel(frag("Removed", true))).toBe("major");
  });
});

describe("computeBump", () => {
  it("takes the highest level across the fragment set", () => {
    expect(computeBump([frag("Fixed"), frag("Added")])).toBe("minor");
    expect(computeBump([frag("Fixed"), frag("Security")])).toBe("patch");
    expect(computeBump([frag("Added"), frag("Fixed", true)])).toBe("major");
  });

  it("defaults to patch for an empty set", () => {
    expect(computeBump([])).toBe("patch");
  });
});
