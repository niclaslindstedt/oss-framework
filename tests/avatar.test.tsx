// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Avatar } from "../src/components/Avatar.tsx";

const icon = <svg data-testid="icon" viewBox="0 0 16 16" />;
const fallback = <svg data-testid="fallback" viewBox="0 0 16 16" />;

describe("Avatar fallback cascade", () => {
  it("renders the image when src is set, beating every other layer", () => {
    const { container, queryByTestId, queryByText } = render(
      <Avatar
        src="data:image/png;base64,x"
        icon={icon}
        initials="AB"
        fallback={fallback}
        alt="A portrait"
      />,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("src")).toBe("data:image/png;base64,x");
    expect(img!.getAttribute("alt")).toBe("A portrait");
    expect(queryByTestId("icon")).toBeNull();
    expect(queryByText("AB")).toBeNull();
  });

  it("renders the icon when there is no image, beating the monogram", () => {
    const { getByTestId, queryByText } = render(
      <Avatar icon={icon} initials="AB" fallback={fallback} />,
    );
    expect(getByTestId("icon")).toBeTruthy();
    expect(queryByText("AB")).toBeNull();
  });

  it("renders the initials monogram when there is no image or icon", () => {
    const { getByText, queryByTestId } = render(
      <Avatar initials="AB" fallback={fallback} />,
    );
    expect(getByText("AB")).toBeTruthy();
    expect(queryByTestId("fallback")).toBeNull();
  });

  it("renders the fallback node when nothing else is present", () => {
    const { getByTestId } = render(<Avatar fallback={fallback} />);
    expect(getByTestId("fallback")).toBeTruthy();
  });

  it("renders an empty disc with no material at all", () => {
    const { container } = render(<Avatar />);
    const disc = container.querySelector("span");
    expect(disc).not.toBeNull();
    expect(disc!.textContent).toBe("");
  });

  it("tints the disc with the given colour", () => {
    const { getByText } = render(
      <Avatar initials="AB" tintColor="rgb(1, 2, 3)" />,
    );
    const disc = getByText("AB").closest("span[style]") as HTMLElement;
    expect(disc.style.color).toBe("rgb(1, 2, 3)");
  });
});

describe("Avatar sizes", () => {
  const cases = [
    ["xs", "h-5 w-5 text-[9px]"],
    ["sm", "h-10 w-10 text-sm"],
    ["md", "h-12 w-12 text-base"],
    ["lg", "h-16 w-16 text-xl"],
    ["xl", "h-24 w-24 text-3xl"],
  ] as const;

  for (const [size, dims] of cases) {
    it(`draws the ${size} disc at ${dims}`, () => {
      const { getByText } = render(<Avatar initials="AB" size={size} />);
      const disc = getByText("AB").parentElement!;
      expect(disc.className).toContain(dims);
    });

    it(`draws the ${size} image at ${dims}`, () => {
      const { container } = render(<Avatar src="x.png" size={size} />);
      expect(container.querySelector("img")!.className).toContain(dims);
    });
  }

  it("defaults to the md size", () => {
    const { getByText } = render(<Avatar initials="AB" />);
    expect(getByText("AB").parentElement!.className).toContain("h-12 w-12");
  });

  it("sizes the icon wrapper per avatar size", () => {
    const { getByTestId } = render(<Avatar icon={icon} size="xl" />);
    expect(getByTestId("icon").parentElement!.className).toContain("h-10 w-10");
  });
});
