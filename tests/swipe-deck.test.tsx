// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @vitest-environment jsdom
import {
  act,
  createEvent,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  DECK_HOME,
  DECK_SCROLLER,
  SwipeDeck,
  type DeckAxis,
  type DeckNav,
  type DeckRelative,
} from "../src/components/SwipeDeck.tsx";

// jsdom implements neither pointer capture nor `matchMedia`, and reports every
// element as zero-sized. The deck reads its host's `clientWidth`/`clientHeight`
// to know how long one page is, so give it a page.
const PAGE = 400;

beforeAll(() => {
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  for (const prop of ["clientWidth", "clientHeight"]) {
    Object.defineProperty(HTMLElement.prototype, prop, {
      configurable: true,
      get() {
        return this.dataset.ui === "swipe-deck" ? PAGE : 0;
      },
    });
  }
  window.matchMedia ??= ((query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
});

afterEach(() => {
  vi.useRealTimers();
});

function deck(): HTMLElement {
  return document.querySelector<HTMLElement>('[data-ui="swipe-deck"]')!;
}
function track(): HTMLElement {
  return deck().querySelector<HTMLElement>("[data-deck-pane]")!.parentElement!;
}

// Two synthetic events fired in the same tick are microseconds apart, so a drag
// left to the clock reads as a flick. Stamp them by hand instead, so the
// release velocity is the test's to decide.
//
// Never stamp one `0`: React's synthetic event resolves `timeStamp` as
// `nativeEvent.timeStamp || Date.now()`, so a falsy stamp silently becomes wall
// clock — and the deck then measures a hundred-millisecond drag against an
// epoch and reads no velocity at all.
function at(
  kind: "pointerDown" | "pointerMove" | "pointerUp",
  el: Element,
  init: Record<string, unknown>,
  time: number,
): void {
  const event = createEvent[kind](el, init);
  Object.defineProperty(event, "timeStamp", { value: time });
  fireEvent(el, event);
}

const down = (x: number, y = 40, t = 1000) =>
  at(
    "pointerDown",
    deck(),
    { pointerId: 1, button: 0, clientX: x, clientY: y },
    t,
  );
const move = (x: number, y = 40, t = 1100) =>
  at("pointerMove", deck(), { pointerId: 1, clientX: x, clientY: y }, t);
const up = (x: number, y = 40, t = 1200) =>
  at("pointerUp", deck(), { pointerId: 1, clientX: x, clientY: y }, t);

type HarnessProps = {
  onStep?: (to: number) => void;
  axis?: DeckAxis;
  canPrevious?: boolean;
  canNext?: boolean;
  scrolls?: boolean;
  renderChrome?: (nav: DeckNav) => React.ReactNode;
  renderItem?: (rel: DeckRelative, nav: DeckNav) => React.ReactNode;
};

/** A deck over the integers, holding its own anchor the way a caller does. */
function Harness({
  onStep,
  axis,
  canPrevious,
  canNext,
  scrolls,
  renderChrome,
  renderItem,
}: HarnessProps) {
  const [at, setAt] = useState(0);
  const step = (to: number) => {
    setAt(to);
    onStep?.(to);
  };
  return (
    <SwipeDeck
      itemKey={String(at)}
      axis={axis}
      scrolls={scrolls}
      canPrevious={canPrevious}
      canNext={canNext}
      onPrevious={() => step(at - 1)}
      onNext={() => step(at + 1)}
      renderChrome={renderChrome}
      renderItem={
        renderItem ??
        ((rel) => <div data-testid={`pane${rel}`}>page {at + rel}</div>)
      }
    />
  );
}

describe("SwipeDeck", () => {
  it("draws the page and both its neighbours", () => {
    render(<Harness />);
    expect(screen.getByTestId("pane-1").textContent).toBe("page -1");
    expect(screen.getByTestId("pane0").textContent).toBe("page 0");
    expect(screen.getByTestId("pane1").textContent).toBe("page 1");
  });

  it("keeps the parked neighbours out of the tab order", () => {
    render(<Harness />);
    const panes = [...deck().querySelectorAll<HTMLElement>("[data-deck-pane]")];
    expect(panes).toHaveLength(3);
    expect(panes.map((p) => p.hasAttribute("inert"))).toEqual([
      true,
      false,
      true,
    ]);
  });

  it("rests with the centre pane on screen", () => {
    render(<Harness />);
    expect(track().style.transform).toBe("translate3d(-100%, 0, 0)");
  });

  it("rests the other way round on the vertical axis", () => {
    render(<Harness axis="y" />);
    expect(track().style.transform).toBe("translate3d(0, -100%, 0)");
  });

  it("steps forward when the chrome's arrow asks", () => {
    const onStep = vi.fn();
    render(
      <Harness
        onStep={onStep}
        renderChrome={(nav) => (
          <button type="button" onClick={nav.next}>
            Next
          </button>
        )}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onStep).toHaveBeenCalledWith(1);
    expect(screen.getByTestId("pane0").textContent).toBe("page 1");
  });

  it("follows the finger without re-rendering the pages", () => {
    render(<Harness />);
    down(300);
    move(200);
    expect(track().style.transform).toBe(
      "translate3d(calc(-100% + -100px), 0, 0)",
    );
    // Still page 0: a drag in flight has moved nothing.
    expect(screen.getByTestId("pane0").textContent).toBe("page 0");
  });

  it("commits a drag past the threshold", () => {
    const onStep = vi.fn();
    render(<Harness onStep={onStep} />);
    down(300);
    move(200);
    up(180);
    expect(onStep).toHaveBeenCalledWith(1);
  });

  it("commits backwards when the drag goes the other way", () => {
    const onStep = vi.fn();
    render(<Harness onStep={onStep} />);
    down(100);
    move(220);
    up(240);
    expect(onStep).toHaveBeenCalledWith(-1);
  });

  it("springs back from a drag that did not go far enough", () => {
    const onStep = vi.fn();
    render(<Harness onStep={onStep} />);
    down(300);
    move(285);
    up(285);
    expect(onStep).not.toHaveBeenCalled();
  });

  it("commits a short but fast flick", () => {
    const onStep = vi.fn();
    render(<Harness onStep={onStep} />);
    down(300, 40, 1000);
    move(290, 40, 1100);
    move(240, 40, 1120); // 2.5 px/ms — well past the flick threshold
    up(240, 40, 1130);
    expect(onStep).toHaveBeenCalledWith(1);
  });

  it("ignores a drag that is mostly across the paging axis", () => {
    const onStep = vi.fn();
    render(<Harness onStep={onStep} />);
    down(300, 40);
    move(240, 300);
    up(200, 320, 1200);
    expect(onStep).not.toHaveBeenCalled();
  });

  it("resists — and refuses — a drag past the end of the row", () => {
    const onStep = vi.fn();
    render(<Harness onStep={onStep} canNext={false} />);
    down(300);
    move(200);
    // A quarter of the travel, so the edge is felt rather than ignored.
    expect(track().style.transform).toBe(
      "translate3d(calc(-100% + -25px), 0, 0)",
    );
    up(180);
    expect(onStep).not.toHaveBeenCalled();
  });

  it("swallows the click a swipe ends with", () => {
    const onPress = vi.fn();
    render(
      <Harness
        renderItem={(rel) => (
          <button type="button" onClick={onPress}>
            page {rel}
          </button>
        )}
      />,
    );
    down(300);
    move(200);
    up(180);
    fireEvent.click(screen.getByRole("button", { name: "page 0" }));
    expect(onPress).not.toHaveBeenCalled();
    // …and only that one: the next click gets through.
    fireEvent.click(screen.getByRole("button", { name: "page 0" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("leaves a press on a text field to the field", () => {
    const onStep = vi.fn();
    render(
      <Harness
        onStep={onStep}
        renderItem={() => <input aria-label="note" defaultValue="hello" />}
      />,
    );
    const field = screen.getAllByLabelText("note")[1]!;
    at(
      "pointerDown",
      field,
      { pointerId: 1, button: 0, clientX: 300, clientY: 40 },
      1000,
    );
    move(200);
    up(180);
    expect(onStep).not.toHaveBeenCalled();
  });

  it("takes the vertical axis when told to", () => {
    const onStep = vi.fn();
    render(<Harness axis="y" onStep={onStep} />);
    at(
      "pointerDown",
      deck(),
      { pointerId: 1, button: 0, clientX: 40, clientY: 300 },
      1000,
    );
    at(
      "pointerMove",
      deck(),
      { pointerId: 1, clientX: 40, clientY: 200 },
      1100,
    );
    at("pointerUp", deck(), { pointerId: 1, clientX: 40, clientY: 180 }, 1200);
    expect(onStep).toHaveBeenCalledWith(1);
  });

  it("leaves the browser both axes on a pane that scrolls", () => {
    const { rerender } = render(<Harness />);
    expect(deck().style.touchAction).toBe("none");
    rerender(<Harness scrolls />);
    expect(deck().style.touchAction).toBe("pan-y");
  });

  it("re-centres immediately when the anchor moves from outside", () => {
    function Outside() {
      const [at, setAt] = useState(0);
      return (
        <>
          <button type="button" onClick={() => setAt(9)}>
            Jump
          </button>
          <SwipeDeck
            itemKey={String(at)}
            onPrevious={() => setAt(at - 1)}
            onNext={() => setAt(at + 1)}
            renderItem={(rel) => <div data-testid={`p${rel}`}>{at + rel}</div>}
          />
        </>
      );
    }
    render(<Outside />);
    down(300);
    move(200);
    expect(track().style.transform).not.toBe("translate3d(-100%, 0, 0)");
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Jump" }));
    });
    expect(screen.getByTestId("p0").textContent).toBe("9");
    expect(track().style.transform).toBe("translate3d(-100%, 0, 0)");
  });

  it("puts a changed pane's scroller back to its home row", () => {
    function Scrolling() {
      const [at, setAt] = useState(0);
      return (
        <SwipeDeck
          itemKey={String(at)}
          axis="y"
          scrolls
          onPrevious={() => setAt(at - 1)}
          onNext={() => setAt(at + 1)}
          renderChrome={(nav) => (
            <button type="button" onClick={nav.next}>
              Next
            </button>
          )}
          renderItem={(rel) => (
            <div {...DECK_SCROLLER} data-testid={`s${rel}`}>
              <div>top</div>
              <div {...DECK_HOME}>home {at + rel}</div>
            </div>
          )}
        />
      );
    }
    render(<Scrolling />);
    screen.getByTestId("s0").scrollTop = 120;
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    // Every pane whose page changed is back at its home offset (0 here, since
    // jsdom gives every rect a zero height)…
    expect(screen.getByTestId("s0").scrollTop).toBe(0);
    expect(screen.getByTestId("s1").scrollTop).toBe(0);
    // …except the one still on screen, sliding out with the page you left.
    expect(screen.getByTestId("s-1").scrollTop).toBe(120);
  });
});
