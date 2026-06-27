// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./styles.css";
import { App } from "./App.tsx";
import { LanguageRoot } from "./app/i18n/index.ts";
import { installPresetTokens } from "./theme-tokens.ts";

// Inject the per-preset theme tokens before the first paint so the default
// theme's colours resolve immediately (see `theme-tokens.ts`).
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
