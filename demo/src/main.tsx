// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { installPresetTokens } from "@niclaslindstedt/oss-framework/theme";

import "./styles.css";
import { App } from "./App.tsx";
import { LanguageRoot } from "./app/i18n/index.ts";

// Inject the per-preset theme tokens before the first paint so the default
// theme's colours resolve immediately. The generator lives in the framework
// (`installPresetTokens`) — this demo builds against source, so it injects the
// blocks at runtime; a published app would instead `@import` the framework's
// prebuilt `styles.css`, which already has them baked in.
installPresetTokens();

const root = document.getElementById("root");
if (!root) throw new Error("missing #root element");

createRoot(root).render(
  <StrictMode>
    <LanguageRoot>
      <App />
    </LanguageRoot>
  </StrictMode>,
);
