import { ts } from "@stavkamil/blueprint/eslint";

export default [
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
