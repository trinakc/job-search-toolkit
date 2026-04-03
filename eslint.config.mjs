import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";
import html from "eslint-plugin-html";

export default defineConfig([
  { files: ["**/*.{js,mjs,cjs}"], plugins: { js }, extends: ["js/recommended"], languageOptions: { globals: globals.browser } },
  { files: ["**/*.js"], languageOptions: { sourceType: "script" } },
  { 
  files: ["**/*.html"], 
  plugins: { js, html }, 
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
    "no-undef": "off"
  }
},
]);