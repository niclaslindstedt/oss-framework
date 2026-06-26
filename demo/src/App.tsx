// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEscapeKey } from "@niclaslindstedt/oss-framework/hooks";

// The framework's preview site. This is the hello-world starting point — no
// component is showcased yet. As the public surface grows, add one demo per
// component: give each its own file under `src/demos/<component>.tsx` that
// imports the framework component it shows (e.g. `ChangelogModal` from
// `@niclaslindstedt/oss-framework/changelog`) and render it in a section below.
//
// We import a real framework export (`useEscapeKey`) here so the build links
// against the framework source — proving the deploy reflects the live commit,
// not a stale published package.
export function App() {
  // Disabled: there is nothing to dismiss yet. Wiring it keeps the framework
  // import exercised by the build.
  useEscapeKey(false, () => {});

  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        maxWidth: "40rem",
        margin: "4rem auto",
        padding: "0 1rem",
        lineHeight: 1.5,
      }}
    >
      <h1>OSS Framework — demo</h1>
      <p>Hello world.</p>
      <p>
        This is the preview site for <code>@niclaslindstedt/oss-framework</code>
        . Component demos will appear here as the framework grows.
      </p>
    </main>
  );
}
