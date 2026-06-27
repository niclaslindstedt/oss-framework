// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A self-contained miniature of the app chrome, rendered straight from a
// palette's colour slots via inline styles — with no dependency on the host's
// Tailwind tokens or the theme currently applied to `<html>`. That independence
// is the point: it lets a settings UI preview *any* palette (every preset, or
// the live Custom colours) side by side, so the themes are distinguishable at a
// glance rather than by name. `AppearancePicker` uses it to turn the theme
// picker into a visual gallery and to live-preview the Custom editor.

import type { CSSProperties } from "react";

import type { CustomThemeColors } from "./palettes.ts";

function Dot({ color, size = 5 }: { color: string; size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 9999,
        background: color,
        display: "inline-block",
      }}
    />
  );
}

/**
 * Render a compact preview of a palette: a faux titlebar, a surface card with a
 * checked + unchecked row, a primary / secondary button pair, and the accent
 * wheel. Every slot that gives a theme its character (backgrounds, text, muted,
 * lines, accent + status colours) shows at once. Purely decorative —
 * `aria-hidden`, since the selectable control around it carries the name.
 */
export function ThemePreview({
  colors,
  className,
  style,
}: {
  colors: CustomThemeColors;
  className?: string;
  style?: CSSProperties;
}) {
  const c = colors;
  return (
    <div
      aria-hidden
      className={className}
      style={{
        background: c.pageBg,
        border: `1px solid ${c.line}`,
        borderRadius: 8,
        overflow: "hidden",
        ...style,
      }}
    >
      {/* Titlebar: accent dot, a faux title, status dots. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          padding: "5px 7px",
          background: c.surface3,
          borderBottom: `1px solid ${c.line}`,
        }}
      >
        <Dot color={c.accent} size={7} />
        <span
          style={{
            height: 5,
            width: 34,
            borderRadius: 9999,
            background: c.muted,
          }}
        />
        <span style={{ marginLeft: "auto", display: "flex", gap: 3 }}>
          <Dot color={c.danger} />
          <Dot color={c.meta} />
          <Dot color={c.success} />
        </span>
      </div>

      <div
        style={{
          padding: 7,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {/* Surface card: a checked + an unchecked row. */}
        <div
          style={{
            background: c.surface,
            border: `1px solid ${c.line}`,
            borderRadius: 6,
            padding: "6px 7px",
            display: "flex",
            flexDirection: "column",
            gap: 5,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                background: c.accent,
                color: c.pageBg,
                fontSize: 9,
                lineHeight: "12px",
                textAlign: "center",
                fontWeight: 700,
              }}
            >
              ✓
            </span>
            <span style={{ color: c.fgBright, fontSize: 11, fontWeight: 600 }}>
              Aa
            </span>
            <span
              style={{
                height: 5,
                flex: 1,
                borderRadius: 9999,
                background: c.fg,
                opacity: 0.85,
              }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                border: `2px solid ${c.muted}`,
                boxSizing: "border-box",
              }}
            />
            <span
              style={{
                height: 5,
                width: "55%",
                borderRadius: 9999,
                background: c.muted,
              }}
            />
          </div>
        </div>

        {/* Primary + secondary buttons. */}
        <div style={{ display: "flex", gap: 5 }}>
          <span
            style={{
              flex: 1,
              textAlign: "center",
              background: c.accent,
              color: c.pageBg,
              fontSize: 9,
              fontWeight: 600,
              borderRadius: 5,
              padding: "3px 0",
            }}
          >
            Aa
          </span>
          <span
            style={{
              flex: 1,
              textAlign: "center",
              background: c.surface2,
              color: c.fg,
              border: `1px solid ${c.line}`,
              fontSize: 9,
              borderRadius: 5,
              padding: "3px 0",
            }}
          >
            Aa
          </span>
        </div>

        {/* Accent wheel. */}
        <div style={{ display: "flex", gap: 4 }}>
          {[c.link, c.path, c.flag, c.pipe, c.meta].map((col, i) => (
            <Dot key={i} color={col} size={8} />
          ))}
        </div>
      </div>
    </div>
  );
}
