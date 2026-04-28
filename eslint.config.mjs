/**
 * ESLint configuration for Gostaylo
 * Catches missing imports, undefined variables, and unused imports
 */
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import unusedImports from "eslint-plugin-unused-imports";

/** Browser + Node so API routes (AbortController, fetch) and client (navigator) both lint clean */
const envGlobals = {
  ...globals.browser,
  ...globals.node,
  React: "readonly",
};

export default [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      ".git/**",
      "*.config.js",
      "*.config.mjs",
      "archive/**",
      "backend/**",
      "prisma/**",
      "frontend/**",
      "**/*.old",
      "**/*.backup",
      "**/*.backup.*",
    ],
  },
  {
    files: ["**/*.js", "**/*.jsx"],
    plugins: {
      react,
      "react-hooks": reactHooks,
      "unused-imports": unusedImports,
    },
    settings: {
      react: { version: "detect" },
    },
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: envGlobals,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      // Critical: Catches undefined variables (like missing icon imports)
      "no-undef": "error",

      // JSX identifiers count as variable uses (fixes false unused-imports on <Card /> etc.)
      "react/jsx-uses-vars": "warn",
      "react/react-in-jsx-scope": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // Catches unused imports that can be removed
      "unused-imports/no-unused-imports": "warn",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
      
      // Other helpful rules
      "no-unused-vars": "off", // Handled by unused-imports plugin
      "no-console": "off", // Allow console for debugging
    },
  },
];
