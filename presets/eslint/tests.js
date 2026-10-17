import vitest from "@vitest/eslint-plugin";
import testingLibrary from "eslint-plugin-testing-library";

/** Rules for spec files: Vitest's recommended set, nothing focused or skipped, Testing Library for components. */
export const tests = [
  {
    files: ["**/*.spec.{ts,tsx}"],
    plugins: { vitest },
    rules: {
      ...vitest.configs.recommended.rules,
      "vitest/no-focused-tests": "error",
      "vitest/no-disabled-tests": "error",
    },
  },
  {
    files: ["**/*.spec.tsx"],
    ...testingLibrary.configs["flat/react"],
  },
];
