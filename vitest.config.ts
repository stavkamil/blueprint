import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // src/index.ts is the three-line bin entry; the tarball smoke test covers it.
      exclude: ["src/**/*.spec.ts", "src/index.ts"],
      thresholds: { lines: 80 },
    },
  },
});
