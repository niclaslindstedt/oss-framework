import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const fontsourceStub = fileURLToPath(
  new URL("./tests/stubs/fontsource.ts", import.meta.url),
);
const workboxStub = fileURLToPath(
  new URL("./tests/stubs/workbox-window.ts", import.meta.url),
);

export default defineConfig({
  // `@fontsource/*` and `workbox-window` are optional peer dependencies (the
  // theme font loaders and the PWA update hook). Neither is installed in this
  // package, so point each specifier at a stub — `@fontsource/*` at an empty
  // module, `workbox-window` at a no-op `Workbox` — so Vite's import analysis
  // can resolve `src/theme/fonts.ts` and `src/pwa/usePwaUpdate.ts` under test.
  resolve: {
    alias: [
      { find: /^@fontsource\/.+/, replacement: fontsourceStub },
      { find: "workbox-window", replacement: workboxStub },
    ],
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
  },
});
