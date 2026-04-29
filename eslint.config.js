import js from "@eslint/js";
import pluginVue from "eslint-plugin-vue";
import globals from "globals";
import tseslint from "typescript-eslint";
import vueParser from "vue-eslint-parser";

export default tseslint.config(
  {
    ignores: ["dist/**"],
  },
  js.configs.recommended,
  ...pluginVue.configs["flat/recommended"],
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,vue}"],
    languageOptions: {
      globals: globals.browser,
      parser: vueParser,
      parserOptions: {
        ecmaVersion: "latest",
        parser: tseslint.parser,
        sourceType: "module",
      },
    },
  }
);
