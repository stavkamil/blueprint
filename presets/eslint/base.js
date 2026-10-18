import js from "@eslint/js";
import vitest from "@vitest/eslint-plugin";
import prettier from "eslint-config-prettier";
import barrelFiles from "eslint-plugin-barrel-files";
import checkFile from "eslint-plugin-check-file";
import jsdoc from "eslint-plugin-jsdoc";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import tseslint from "typescript-eslint";

const routeFiles =
  "**/app/**/{page,layout,loading,error,not-found,route,template,default}.{ts,tsx}";
const configFiles = "**/*.config.{js,mjs,cjs,ts}";
const specFiles = "**/*.spec.{ts,tsx}";

/** Rules every blueprint project shares: TypeScript and module standards from the lint catalog. */
export const base = [
  { ignores: ["dist/", "coverage/", ".next/", "node_modules/", "next-env.d.ts"] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: { parserOptions: { projectService: true } },
    plugins: {
      "barrel-files": barrelFiles,
      "check-file": checkFile,
      jsdoc,
      "simple-import-sort": simpleImportSort,
      vitest,
    },
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: "ExportDefaultDeclaration", message: "Use a named export." },
        {
          selector: "TSUnionType > TSLiteralType",
          message: "Define a const object and derive the type from its values (see typescript.md).",
        },
        {
          selector: "CallExpression[callee.property.name='then']",
          message: "Use async/await instead of .then().",
        },
      ],
      "barrel-files/avoid-barrel-files": "error",
      "barrel-files/avoid-re-export-all": "error",
      "check-file/filename-naming-convention": [
        "error",
        { "**/*.{ts,tsx,js,mjs}": "KEBAB_CASE" },
        { ignoreMiddleExtensions: true },
      ],
      "check-file/folder-naming-convention": ["error", { "src/**/": "KEBAB_CASE" }],
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/only-throw-error": "error",
      "func-style": ["error", "expression"],
      "prefer-arrow-callback": "error",
      "@typescript-eslint/naming-convention": [
        "error",
        { selector: "default", format: ["strictCamelCase"], leadingUnderscore: "allow" },
        {
          selector: "variable",
          format: ["strictCamelCase", "StrictPascalCase"],
          leadingUnderscore: "allow",
        },
        {
          selector: "variable",
          types: ["boolean"],
          format: ["StrictPascalCase"],
          prefix: ["is", "has", "should", "can"],
        },
        { selector: "variable", modifiers: ["destructured"], format: null },
        { selector: "function", format: ["strictCamelCase", "StrictPascalCase"] },
        { selector: "typeLike", format: ["StrictPascalCase"] },
        { selector: "import", format: null },
        {
          selector: ["objectLiteralProperty", "typeProperty", "objectLiteralMethod"],
          format: null,
        },
      ],
      "no-magic-numbers": "off",
      "@typescript-eslint/no-magic-numbers": [
        "error",
        {
          ignore: [-1, 0, 1],
          ignoreArrayIndexes: true,
          ignoreDefaultValues: true,
          ignoreTypeIndexes: true,
          ignoreReadonlyClassProperties: true,
          ignoreNumericLiteralTypes: true,
        },
      ],
      "no-param-reassign": ["error", { props: true }],
      "no-console": ["error", { allow: ["warn", "error"] }],
      "jsdoc/require-jsdoc": [
        "error",
        {
          publicOnly: true,
          require: { ArrowFunctionExpression: true, ClassDeclaration: true },
          contexts: ["TSTypeAliasDeclaration", "ExportNamedDeclaration > VariableDeclaration"],
        },
      ],
      "jsdoc/require-description": "error",
      "jsdoc/no-types": "error",
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "vitest/consistent-test-filename": ["error", { pattern: String.raw`.*\.spec\.[tj]sx?$` }],
    },
  },
  {
    files: ["**/*.ts"],
    rules: { "@typescript-eslint/explicit-module-boundary-types": "error" },
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: [routeFiles, configFiles],
    rules: { "no-restricted-syntax": "off", "jsdoc/require-jsdoc": "off" },
  },
  {
    files: ["**/constants.ts", "src/config/**", specFiles, configFiles],
    rules: { "@typescript-eslint/no-magic-numbers": "off" },
  },
  {
    files: [specFiles],
    rules: { "jsdoc/require-jsdoc": "off" },
  },
  prettier,
];
