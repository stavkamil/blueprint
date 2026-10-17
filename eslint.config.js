// Local config until the config-presets module ships blueprint's own `ts` preset, which replaces this file.
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import jsdoc from "eslint-plugin-jsdoc";
import tseslint from "typescript-eslint";

export default [
  { ignores: ["dist/", "coverage/", "node_modules/"] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: { parserOptions: { projectService: true } },
    plugins: { jsdoc },
    rules: {
      "func-style": ["error", "expression"],
      "prefer-arrow-callback": "error",
      "no-restricted-syntax": [
        "error",
        { selector: "ExportDefaultDeclaration", message: "Use a named export." },
        {
          selector: "TSUnionType > TSLiteralType",
          message: "Define a const object and derive the type from its values.",
        },
        {
          selector: "CallExpression[callee.property.name='then']",
          message: "Use async/await instead of .then().",
        },
      ],
      "no-console": ["error", { allow: ["warn", "error"] }],
      "no-param-reassign": ["error", { props: true }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "jsdoc/require-jsdoc": [
        "error",
        {
          publicOnly: true,
          require: { ArrowFunctionExpression: true, ClassDeclaration: true },
          contexts: ["TSTypeAliasDeclaration"],
        },
      ],
      "jsdoc/no-types": "error",
    },
  },
  {
    files: ["**/*.js"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ["*.config.{js,ts}"],
    rules: { "no-restricted-syntax": "off" },
  },
  {
    files: ["**/*.spec.ts"],
    rules: { "jsdoc/require-jsdoc": "off" },
  },
  prettier,
];
