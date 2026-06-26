import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default [
  {
    // Build output, dependencies, and the cloned reference apps the
    // find-refactor-candidates skill checks out are not framework source
    // and are out of scope for the linter.
    ignores: ["dist/**", "node_modules/**", ".reference/**"],
  },
  js.configs.recommended,
  {
    // Node tooling scripts (the skill's clone / similarity helpers). These
    // run under Node, so expose its globals rather than the browser's.
    files: [".agent/**/*.mjs", "scripts/**/*.mjs"],
    languageOptions: {
      sourceType: "module",
      ecmaVersion: 2022,
      globals: { ...globals.node },
    },
  },
  {
    files: ["src/**/*.{ts,tsx}", "tests/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
      globals: { ...globals.browser },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // TypeScript checks for undefined identifiers itself; the core rule
      // only produces false positives for DOM/Web globals.
      "no-undef": "off",
      // The core rule misfires on TypeScript type-level constructs (e.g. a
      // named parameter in a bare function type); defer to the TS-aware one,
      // which also honours the `_`-prefix convention for intentional unused.
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      // Rules that arrived enabled-by-default in the ESLint 10 /
      // eslint-plugin-react-hooks 7 majors. They fire on deliberate, working
      // patterns (reading a ref in an event handler to stash scroll position;
      // resetting derived state when the modal reopens), so they're turned off
      // to preserve the pre-bump lint surface; adopting them is a separate
      // refactor. Mirrors the source apps' configuration.
      "no-useless-assignment": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
];
