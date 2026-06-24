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
    },
  },
];
