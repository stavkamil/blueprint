import { defineConfig } from "vitest/config";

// Slow, networked checks that create real projects; `pnpm test:e2e` runs them in their own CI job.
export default defineConfig({
  test: {
    include: ["tests/e2e/**/*.spec.ts"],
    testTimeout: 600_000,
    hookTimeout: 120_000,
  },
});
