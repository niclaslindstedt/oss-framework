import { defineConfig } from "tsup";

// Library build. Each entry becomes its own subpath export (see the
// `exports` map in package.json) so consumers can `import { useEscapeKey }
// from "@niclaslindstedt/oss-framework"` or pull a narrower slice from
// `.../hooks` and let their bundler tree-shake the rest.
export default defineConfig({
  entry: {
    index: "src/index.ts",
    "hooks/index": "src/hooks/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  // React is provided by the host app — never bundle a second copy.
  external: ["react", "react-dom"],
});
