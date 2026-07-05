// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  BuildingIcon,
  CalendarIcon,
  CheckSquareIcon,
  CodeIcon,
  CropIcon,
  DownloadIcon,
  FileIcon,
  GiftIcon,
  GlobeIcon,
  ImageUpIcon,
  InfoIcon,
  ListIcon,
  MailIcon,
  MapPinIcon,
  PaperclipIcon,
  PersonIcon,
  PhoneIcon,
  StarIcon,
  UploadIcon,
  type IconProps,
} from "../src/components/icons.tsx";

// The generic marks upstreamed from the contacts app. Each is a thin outline
// glyph over the shared `<Glyph>` shell — one render apiece proves the shell
// chrome (decorative, currentColor stroke) and the className pass-through.
const outlineIcons: [string, (props: IconProps) => React.JSX.Element][] = [
  ["BuildingIcon", BuildingIcon],
  ["CalendarIcon", CalendarIcon],
  ["CheckSquareIcon", CheckSquareIcon],
  ["CodeIcon", CodeIcon],
  ["CropIcon", CropIcon],
  ["DownloadIcon", DownloadIcon],
  ["FileIcon", FileIcon],
  ["GiftIcon", GiftIcon],
  ["GlobeIcon", GlobeIcon],
  ["ImageUpIcon", ImageUpIcon],
  ["InfoIcon", InfoIcon],
  ["ListIcon", ListIcon],
  ["MailIcon", MailIcon],
  ["MapPinIcon", MapPinIcon],
  ["PaperclipIcon", PaperclipIcon],
  ["PersonIcon", PersonIcon],
  ["PhoneIcon", PhoneIcon],
  ["StarIcon", StarIcon],
  ["UploadIcon", UploadIcon],
];

describe("generic icons", () => {
  it.each(outlineIcons)(
    "%s renders a decorative outline SVG that forwards a className",
    (_name, Icon) => {
      const { container } = render(<Icon className="h-4 w-4" />);
      const svg = container.querySelector("svg")!;
      expect(svg).not.toBeNull();
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.getAttribute("class")).toBe("h-4 w-4");
      expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
      expect(svg.getAttribute("stroke")).toBe("currentColor");
      expect(svg.getAttribute("fill")).toBe("none");
    },
  );

  it("StarIcon fills its body with currentColor when `filled`, keeping the stroke", () => {
    const { container, rerender } = render(<StarIcon className="s" />);
    expect(container.querySelector("path")?.getAttribute("fill")).toBe("none");

    rerender(<StarIcon className="s" filled />);
    const path = container.querySelector("path")!;
    expect(path.getAttribute("fill")).toBe("currentColor");
    expect(container.querySelector("svg")?.getAttribute("stroke")).toBe(
      "currentColor",
    );
  });
});
