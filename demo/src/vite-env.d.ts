// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
/// <reference types="vite/client" />
//
// Pulls in Vite's ambient client types so the demo typechecks the way it
// builds: `import.meta.env` (the Developer tab reads `import.meta.env.MODE`)
// and the side-effecting asset imports (`import "./styles.css"`) both resolve.

// The framework package version, inlined by Vite's `define` (see
// `vite.config.ts`) and shown as the "Source code" row's subtitle.
declare const __APP_VERSION__: string;
