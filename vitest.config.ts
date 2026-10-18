import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.spec.ts", "tests/**/*.spec.ts"],
    // The end-to-end projects run with `pnpm test:e2e` (vitest.e2e.config.ts).
    exclude: ["tests/e2e/**"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // src/index.ts is the three-line bin entry; the tarball smoke test covers it.
      exclude: ["src/**/*.spec.ts", "src/**/testing/**", "src/index.ts"],
      thresholds: { lines: 80 },
    },
  },
});
