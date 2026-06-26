// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useEffect, useRef, useState } from "react";

import {
  Button,
  Checkbox,
  ClearableInput,
  Modal,
  SelectPicker,
  CogIcon,
  DatabaseIcon,
  PaletteIcon,
  SparklesIcon,
  TrashIcon,
  type SelectOption,
} from "@niclaslindstedt/oss-framework/components";
import {
  AppearancePicker,
  type ThemeAppearance,
} from "@niclaslindstedt/oss-framework/theme";
import {
  BrowserLocalStorageAdapter,
  ConflictError,
  type StorageAdapter,
} from "@niclaslindstedt/oss-framework/storage";

type Props = {
  appearance: ThemeAppearance;
  onChange: (next: ThemeAppearance) => void;
};

// The flagship demo: a tiny "hello world" app built entirely from the
// framework's shared UI primitives — Button, Checkbox, ClearableInput,
// SelectPicker, the inline glyphs — fronting a Settings `Modal` whose two
// tabs reuse the theme and storage modules. It is the one screen that shows
// the design vocabulary and the feature modules working together.
export function ComponentsDemo({ appearance, onChange }: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-fg-bright">UI primitives</h2>
          <p className="text-sm text-muted">
            A hello-world built from the shared <code>/components</code>{" "}
            vocabulary, with a tabbed settings modal over the theme and storage
            modules.
          </p>
        </div>
        <Button variant="primary" onClick={() => setSettingsOpen(true)}>
          <span className="flex items-center gap-1.5">
            <CogIcon className="h-4 w-4" /> Settings
          </span>
        </Button>
      </div>

      <Greeter />
      <GlyphGallery />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        appearance={appearance}
        onChange={onChange}
      />
    </section>
  );
}

// --- the hello-world playground -----------------------------------------

type Style = "hello" | "hi" | "hey" | "howdy";

const STYLE_OPTIONS: SelectOption<Style>[] = [
  { value: "hello", label: "Hello", hint: "the classic" },
  { value: "hi", label: "Hi", hint: "friendly" },
  { value: "hey", label: "Hey", hint: "casual" },
  { value: "howdy", label: "Howdy", hint: "with a hat" },
];

function Greeter() {
  const [name, setName] = useState("world");
  const [style, setStyle] = useState<Style>("hello");
  const [shout, setShout] = useState(false);
  const [greeting, setGreeting] = useState<string | null>(null);

  function greet() {
    const who = name.trim() || "world";
    const lead = STYLE_OPTIONS.find((o) => o.value === style)?.value ?? "hello";
    const word = lead.charAt(0).toUpperCase() + lead.slice(1);
    const message = `${word}, ${who}!`;
    setGreeting(shout ? message.toUpperCase() : message);
  }

  return (
    <div className="flex flex-col gap-4 rounded-md border border-line bg-surface p-4">
      <h3 className="text-sm font-bold text-fg-bright">Say hello</h3>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <label className="flex flex-col gap-1 text-xs font-bold tracking-wide text-muted uppercase">
          Name
          <div className="rounded-md border border-line bg-surface-2 px-2.5 py-1.5 focus-within:border-accent">
            <ClearableInput
              value={name}
              onValueChange={setName}
              placeholder="who are we greeting?"
              clearLabel="Clear name"
              className="text-sm"
            />
          </div>
        </label>

        <label className="flex flex-col gap-1 text-xs font-bold tracking-wide text-muted uppercase">
          Style
          <SelectPicker
            value={style}
            options={STYLE_OPTIONS}
            onChange={setStyle}
            ariaLabel="Greeting style"
            placement={{ width: { kind: "min", minPx: 200 } }}
          />
        </label>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-fg">
        <Checkbox
          checked={shout}
          onChange={setShout}
          ariaLabel="Shout the greeting"
        />
        Shout it
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={greet}>
          <span className="flex items-center gap-1.5">
            <SparklesIcon className="h-4 w-4" /> Greet
          </span>
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setName("world");
            setStyle("hello");
            setShout(false);
            setGreeting(null);
          }}
        >
          Reset
        </Button>
      </div>

      {greeting && (
        <output className="rounded-md border border-accent bg-accent/10 px-3 py-2 text-lg font-bold text-accent">
          {greeting}
        </output>
      )}
    </div>
  );
}

// --- a glyph gallery ----------------------------------------------------

function GlyphGallery() {
  return (
    <div className="rounded-md border border-line bg-surface p-4">
      <h3 className="mb-3 text-xs font-bold tracking-wide text-muted uppercase">
        Glyphs (each paints <code>currentColor</code>)
      </h3>
      <div className="flex flex-wrap gap-4 text-fg">
        <GlyphCell icon={<PaletteIcon className="h-5 w-5" />} name="Palette" />
        <GlyphCell
          icon={<DatabaseIcon className="h-5 w-5" />}
          name="Database"
        />
        <GlyphCell icon={<CogIcon className="h-5 w-5" />} name="Cog" />
        <GlyphCell
          icon={<SparklesIcon className="h-5 w-5 text-accent" />}
          name="Sparkles"
        />
        <GlyphCell
          icon={<TrashIcon className="h-5 w-5 text-danger" />}
          name="Trash"
        />
      </div>
    </div>
  );
}

function GlyphCell({ icon, name }: { icon: React.ReactNode; name: string }) {
  return (
    <span className="flex w-16 flex-col items-center gap-1.5 text-center">
      {icon}
      <span className="text-[10px] text-muted">{name}</span>
    </span>
  );
}

// --- a custom settings modal: Theme + Storage tabs ----------------------
//
// Rather than reuse the theme module's own `SettingsModal`, this builds a
// fresh one from the framework `Modal` primitive to show how an app composes
// its own tabbed dialog — the theme tab embeds the module's `AppearancePicker`,
// the storage tab drives a `StorageAdapter`.

type Tab = "theme" | "storage";

function SettingsModal({
  open,
  onClose,
  appearance,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
} & Props) {
  const [tab, setTab] = useState<Tab>("theme");

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="demo-settings-title"
      centered
      size="max-w-2xl"
      closeLabel="Close settings"
    >
      <div className="flex items-center justify-between border-b border-line bg-surface-3 px-4 py-3">
        <h2
          id="demo-settings-title"
          className="text-base font-bold text-fg-bright"
        >
          Settings
        </h2>
        <Button variant="ghost" onClick={onClose} aria-label="Close settings">
          Done
        </Button>
      </div>

      <div className="flex gap-1 border-b border-line bg-surface-2 px-2 pt-2">
        <TabButton
          active={tab === "theme"}
          onClick={() => setTab("theme")}
          icon={<PaletteIcon className="h-4 w-4" />}
          label="Theme"
        />
        <TabButton
          active={tab === "storage"}
          onClick={() => setTab("storage")}
          icon={<DatabaseIcon className="h-4 w-4" />}
          label="Storage"
        />
      </div>

      <div className="overflow-y-auto p-4">
        {tab === "theme" ? (
          <AppearancePicker appearance={appearance} onChange={onChange} />
        ) : (
          <StoragePanel />
        )}
      </div>
    </Modal>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex cursor-pointer items-center gap-1.5 rounded-t-md border-b-2 px-3 py-1.5 text-sm transition-colors " +
        (active
          ? "border-accent text-accent"
          : "border-transparent text-muted hover:text-fg")
      }
    >
      {icon}
      {label}
    </button>
  );
}

// A compact storage playground inside the settings dialog: one
// `StorageAdapter` (the browser/localStorage backend), driven by the shared
// primitives. Save persists across reloads; a second tab saving meanwhile
// surfaces a `ConflictError`.
const DOC_KEY = "oss-demo:components:document";

function StoragePanel() {
  const [adapter] = useState<StorageAdapter>(
    () => new BrowserLocalStorageAdapter({ key: DOC_KEY }),
  );
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  const baseRevision = useRef<string | undefined>(undefined);

  const reload = useCallback(async () => {
    const snap = await adapter.load();
    setText(snap?.text ?? "");
    baseRevision.current = snap?.revision;
    setStatus(snap ? `loaded ${snap.text.length} B` : "nothing stored yet");
  }, [adapter]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function save() {
    try {
      const saved = await adapter.save(text, baseRevision.current);
      baseRevision.current = saved.revision;
      setStatus("saved — reload the page, it persists");
    } catch (err) {
      if (err instanceof ConflictError) {
        setText(err.remote.text);
        baseRevision.current = err.remote.revision;
        setStatus("ConflictError — adopted the other tab's bytes");
      } else {
        setStatus(err instanceof Error ? err.message : String(err));
      }
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        One <code>StorageAdapter</code> (the browser backend). The editor talks
        only to the contract — save, reload, and a cross-tab{" "}
        <code>ConflictError</code> all work for real.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        spellCheck={false}
        placeholder="Type a document, then Save. Reload the page — it persists."
        className="w-full resize-y rounded-md border border-line bg-surface-2 p-2 font-mono text-sm text-fg outline-none focus:border-accent"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={save}>
          Save
        </Button>
        <Button variant="secondary" onClick={() => void reload()}>
          Reload
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setText("");
            setStatus("");
          }}
        >
          Clear editor
        </Button>
        {status && <span className="text-sm text-success">{status}</span>}
      </div>
    </div>
  );
}
