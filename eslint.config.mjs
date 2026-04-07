import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";
import html from "eslint-plugin-html";
import noSecrets from "eslint-plugin-no-secrets";

// The no-secrets plugin scans string literals and comments for high-entropy values
// and known secret patterns. We apply it to both JS and HTML files.
export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs}"],
    plugins: { js, "no-secrets": noSecrets },
    extends: ["js/recommended"],
    languageOptions: { globals: globals.browser },
    rules: {
      // Set tolerance to 5 to reduce false positives while still catching likely secrets.
      "no-secrets/no-secrets": ["error", { tolerance: 5 }]
    }
  },
  { files: ["**/*.js"], languageOptions: { sourceType: "script" } },
  {
    files: ["**/*.html"],
    plugins: { js, html, "no-secrets": noSecrets },
    extends: ["js/recommended"],
    languageOptions: {
      globals: {
        ...globals.browser,
        API_CONFIG: "readonly"
      },
      sourceType: "script"
    },
    rules: {
      "no-unused-vars": "off",
      "no-undef": "off",
      // Also run secret scanning against inline scripts inside HTML files.
      "no-secrets/no-secrets": ["error", { tolerance: 5 }]
    }
  },
]);
