import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": new URL("src", import.meta.url).pathname } },
  test: {
    environment: "jsdom",
    include: ["src/**/*.spec.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.spec.{ts,tsx}",
        "src/**/*.d.ts",
        "src/**/types.ts",
        // Route files are thin and covered by their own specs or by Next.js itself.
        "src/app/**/{page,layout,loading,error,not-found,template,default,route}.{ts,tsx}",
      ],
      thresholds: { lines: 80 },
    },
  },
});
