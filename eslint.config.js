import { ts } from "@stavkamil/blueprint/eslint";

export default [
  // Template files contain {{placeholders}}; the end-to-end test lints the rendered projects instead.
  { ignores: ["templates/"] },
  ...ts,
  {
    // Prettier loads a shareable config from its default export.
    files: ["presets/prettier/**"],
    rules: { "no-restricted-syntax": "off" },
  },
  {
    // Preset files are plain JavaScript without type information.
    files: ["**/*.js"],
    rules: { "@typescript-eslint/naming-convention": "off" },
  },
];
