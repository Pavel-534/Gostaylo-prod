/**
 * ESLint configuration for Gostaylo
 * Catches missing imports, undefined variables, and unused imports
 */
import unusedImports from "eslint-plugin-unused-imports";

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
      globals: {
        React: "readonly",
        process: "readonly",
        console: "readonly",
        window: "readonly",
        document: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        fetch: "readonly",
        FormData: "readonly",
        File: "readonly",
        Blob: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        Headers: "readonly",
        Request: "readonly",
        Response: "readonly",
        CustomEvent: "readonly",
        Event: "readonly",
        Image: "readonly",
        module: "readonly",
        require: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        Buffer: "readonly",
      },
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
