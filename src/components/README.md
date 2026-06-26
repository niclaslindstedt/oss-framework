<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# `@niclaslindstedt/oss-framework/components`

The shared **UI primitives** — the consistent design vocabulary an app builds
its surfaces from. One implementation of the dialog, the buttons, the form
controls, the dropdown, and the inline glyph set, so two apps stop hand-copying
the same chrome between each other.

## What it owns vs. what stays in your app

The framework owns the **primitive** — the markup, the accessibility wiring, the
keyboard behaviour, the float math. Your app owns everything **domain**: the
content inside a `Modal`, the option list a `SelectPicker` shows, which buttons
go where. The primitives carry **no i18n, no domain types, and no asset
imports** — the few strings that face the user inject as props with English
defaults.

| Export                                         | Kind      | What it is                                                                                                 |
| ---------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------- |
| `Modal`                                        | component | Portalled accessible dialog: dimmed backdrop, focus trap, scroll lock, stacked-Escape.                     |
| `Button`                                       | component | Themed button, four variants (`primary` / `secondary` / `ghost` / `danger`).                               |
| `Checkbox`                                     | component | Accessible custom checkbox (hidden native input + drawn box).                                              |
| `ClearableInput`                               | component | Text input with an inline clear (×) button.                                                                |
| `SelectPicker`                                 | component | Custom `<select>` replacement: listbox dropdown with full keyboard nav.                                    |
| `SegmentedControl`                             | component | Radio group for a small, always-visible mutually-exclusive choice (active option outlined).                |
| `Section` / `Field` / `ToggleRow`              | component | Settings-layout building blocks: a bordered group card, a labelled control row, a checkbox+label+hint row. |
| `CipherGlyph`                                  | component | An "encryptish" busy indicator — a run of re-scrambling cipher glyphs, used in place of a spinner.         |
| `FloatingPanel`                                | component | Portalled dropdown/popover shell — float position + dismissal + portal.                                    |
| `DismissBackdrop`                              | component | Invisible outside-tap catcher (with the iOS trailing-tap swallow).                                         |
| `useFloatingPosition` / `computeFloatingRect`  | hook/fn   | Anchor a floating element to a trigger; flip + clamp into the viewport.                                    |
| `APP_VIEWPORT_RECT`                            | const     | `CSSProperties` that pin a fixed overlay over the app shell band.                                          |
| `CheckIcon`, `ChevronDownIcon`, `CloseIcon`, … | component | Dependency-free inline SVG glyph set, each driven by `className`.                                          |

## The contract

The primitives paint entirely through the framework **theme token vocabulary**
(see [`../theme/README.md`](../theme/README.md)) — they assume your stylesheet
maps these Tailwind colour utilities onto the theme slot CSS variables:

`bg-surface` · `bg-surface-2` · `bg-surface-3` · `text-fg` · `text-fg-bright` ·
`text-muted` · `text-page-bg` · `border-line` · `text-accent` / `bg-accent` ·
`text-danger` / `bg-danger`.

Corners read the radius tokens (`rounded-sm` / `rounded-md` / `rounded-lg` →
`--radius-sm/md/lg`). If you adopt the framework `theme` module these resolve for
free; otherwise define the slots (the `@theme inline` block in the demo's
`styles.css` is a worked example).

Two further contracts:

- **`Modal` / overlays read `--app-top` and `--app-height`** (via
  `APP_VIEWPORT_RECT`) to follow the iOS soft keyboard. **Both are optional** —
  the fallbacks reproduce a plain `inset: 0`, so a modal is correct out of the
  box. Set the vars (e.g. mirror `window.visualViewport` into them) only if you
  want overlays to track the keyboard.
- **Glyphs paint `currentColor`** and take only a `className` — size and colour
  flow from `text-*` / `h-* w-*` utilities on the call site.

## Install / usage

```tsx
import {
  Modal,
  Button,
  SelectPicker,
  ClearableInput,
  Checkbox,
  CogIcon,
} from "@niclaslindstedt/oss-framework/components";

function SettingsButton() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState("midnight");
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <CogIcon className="h-4 w-4" /> Settings
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        labelledBy="settings-title"
        centered
        closeLabel="Close"
      >
        <h2 id="settings-title" className="p-4 text-lg font-bold">
          Settings
        </h2>
        <div className="p-4">
          <SelectPicker
            value={theme}
            ariaLabel="Theme"
            onChange={setTheme}
            options={[
              { value: "midnight", label: "Midnight" },
              { value: "daylight", label: "Daylight" },
            ]}
          />
        </div>
      </Modal>
    </>
  );
}
```

`react` and `react-dom` are peer dependencies (the components portal through
`react-dom`). There are no other runtime dependencies.

### Settings layout (`Section` / `Field` / `ToggleRow`)

`Section`, `Field`, and `ToggleRow` are the layout glue a settings surface is
assembled from — they arrange controls, they don't own them. Drop the other
primitives (`SegmentedControl`, `SelectPicker`, …) inside a `Field`, and a
`Section` becomes one group of a tab:

```tsx
import {
  Section,
  Field,
  ToggleRow,
  SegmentedControl,
} from "@niclaslindstedt/oss-framework/components";

<Section title="Appearance">
  <Field label="Theme">
    <SegmentedControl
      value={mode}
      onChange={setMode}
      ariaLabel="Theme"
      options={[
        { value: "dark", label: "Dark" },
        { value: "light", label: "Light" },
      ]}
    />
  </Field>
  <ToggleRow
    label="Reduce motion"
    hint="Calms animations"
    checked={reduceMotion}
    onChange={setReduceMotion}
  />
</Section>;
```

`Section`/`Field` name their group for assistive tech (`role="group"` +
`aria-labelledby`); `ToggleRow` wraps the framework `Checkbox` with a visible
label and an optional hint. All strings inject as props — no i18n inside.

> **There is no `SegmentedRow`.** A segmented row of choices is
> `SegmentedControl` (string options only). If a row carries **numeric** values
> (a font-scale picker, say), keep a tiny app-local segmented row for that case —
> `SegmentedControl<T extends string>` deliberately doesn't admit numbers.

### Busy indicator (`CipherGlyph`)

`CipherGlyph` is a spinner alternative for "work in flight" — a short run of
monospace cipher glyphs that continuously re-scramble, evoking bytes being
enciphered rather than a rotating spinner. It owns only the animation; the
caller decides when it shows and what label sits beside it:

```tsx
import { CipherGlyph } from "@niclaslindstedt/oss-framework/components";

{
  busy ? (
    <span className="flex items-center gap-2 text-accent">
      <CipherGlyph /> enciphering…
    </span>
  ) : (
    status
  );
}
```

It is decorative (`aria-hidden`) and takes only an optional `className` (its
colour and size flow from `text-*` on the call site). It **honours reduce-motion
both ways**: it never starts its timer under the OS `prefers-reduced-motion`
preference, and it freezes mid-frame while `<html data-reduce-motion="true">` is
set (the attribute the framework `theme` engine mirrors the in-app toggle onto).
With motion off it holds a static frame, which still reads as enciphered bytes.
Because the localStorage backends resolve in well under a frame, pair it with a
small minimum-display window (a standard anti-flicker beat) when fronting a fast
async op so the animation reads rather than flashes past.

## Migrating an existing implementation

These primitives were distilled from two apps that each maintained their own
copies. Moving onto the framework, in degree-of-match order:

### Near-exact match (you already have these components)

Delete your local `Modal` / `Button` / `Checkbox` / `ClearableInput` /
`SelectPicker` / `FloatingPanel` / `DismissBackdrop` / `useFloatingPosition` /
settings-layout (`Section` / `Field` / `ToggleRow`) and import them here instead.
Drop the **app glue at the seam** rather than threading it through:

- **i18n.** Replace a `useT("common.close")` lookup inside the component with the
  injected prop (`Modal`'s `closeLabel`, `ClearableInput`'s `clearLabel`). Pass
  your translated string from the call site; the default is English.
- **Icons.** If your controls imported app icons (or `lucide-react`), switch to
  this module's glyph set, or keep passing your own glyphs where a component
  takes `ReactNode`.
- **Escape handling.** `FloatingPanel` already uses the framework's
  `useEscapeKey`; delete any local copy.

### Partial match (the common case)

Most adopters won't line up exactly. The mismatches and how to reconcile each:

- **Your theme has _fewer_ slots than the primitives use.** A control references
  a slot (e.g. `surface-3`, `fg-bright`) your stylesheet never defined → it
  renders unstyled/transparent. **Add the missing CSS variable** (map it to an
  existing colour if you don't want a new one). Map of slots used is in "The
  contract" above.
- **Your radius vocabulary differs.** The apps drifted between a single
  `--radius` and a `--radius-sm/md/lg` triple; the framework standardised on the
  triple. If your app still uses one radius, alias the three to it in CSS
  (`--radius-sm: var(--radius); …`), or adopt the triple.
- **Your `Button` had different variants.** This `Button` ships
  `primary | secondary | ghost | danger`. A filled-neutral button is
  `secondary`; a quiet text-only button is `ghost`. If your old "secondary" was
  text-only, switch those call sites to `ghost`. Per-call overrides still go
  through `className` (merged after the variant class, so later utilities win).
- **Your `Modal` didn't portal / had no stacked-Escape.** This one always
  portals to `document.body` and only dismisses the **top** modal on Escape.
  That's a superset — no call-site change needed, but if you relied on the modal
  living inline in the DOM tree, note it now mounts at the body.
- **Your `SelectPicker` trigger looked different.** Pass `triggerClassName` to
  restyle the trigger and `panelClassName` for the dropdown; the defaults are a
  bordered field.
- **You need a glyph this set doesn't have.** Keep your own glyph component
  app-side and pass it in (the components that show icons accept `ReactNode`), or
  propose widening the framework set.

## Verification

After wiring, confirm the app still behaves:

- A `Modal` opens centered (with `centered`) or full-screen on mobile, traps
  focus, locks body scroll, and Escape peels one layer at a time when stacked.
- A `SelectPicker` opens on click/Enter/Space/Arrow, moves the highlight with
  the arrow keys, commits on Enter, and dismisses on Escape / outside-click
  without committing.
- Buttons, checkboxes, and inputs pick up your theme colours and switch with the
  active theme.
- The glyphs inherit `text-*` colour and `h-*/w-*` size from their call site.
