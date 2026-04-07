import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";
import html from "eslint-plugin-html";
import noSecrets from "eslint-plugin-no-secrets";

export default defineConfig([
  { files: ["**/*.{js,mjs,cjs}"], plugins: { js, "no-secrets": noSecrets }, extends: ["js/recommended"], languageOptions: { globals: globals.browser }, rules: { "no-secrets/no-secrets": ["error", { tolerance: 5 }] } },
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
    "no-secrets/no-secrets": ["error", { tolerance: 5 }]
  }
},
]);
