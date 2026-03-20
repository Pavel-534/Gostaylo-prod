/**
 * ESLint configuration for Gostaylo
 * Catches missing imports, undefined variables, and unused imports
 */
import globals from "globals";
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
      "unused-imports": unusedImports,
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
