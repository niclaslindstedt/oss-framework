import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const fontsourceStub = fileURLToPath(
  new URL("./tests/stubs/fontsource.ts", import.meta.url),
);

export default defineConfig({
  // `@fontsource/*` is an optional peer dependency of the theme font loaders,
  // not installed in this package. Point every such CSS specifier at an empty
  // stub so Vite's import analysis can resolve `src/theme/fonts.ts` under test.
  resolve: {
    alias: [{ find: /^@fontsource\/.+/, replacement: fontsourceStub }],
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
  },
});
