import { describe, expect, it } from "vitest";

import { mergePackageJson } from "./merge-package-json.ts";

describe("mergePackageJson", () => {
  it("combines scripts and dependencies from every part", () => {
    const base = { scripts: { lint: "eslint ." }, devDependencies: { eslint: "^10" } };
    const layer = { scripts: { build: "tsc" }, devDependencies: { vitest: "^5" } };

    const merged = mergePackageJson(base, layer);

    expect(merged).toEqual({
      scripts: { lint: "eslint .", build: "tsc" },
      devDependencies: { eslint: "^10", vitest: "^5" },
    });
  });

  it("lets later parts override earlier values", () => {
    const existing = { name: "demo", devDependencies: { typescript: "^5" } };
    const layer = { devDependencies: { typescript: "~6.0.3" } };

    const merged = mergePackageJson(existing, layer);

    expect(merged).toEqual({ name: "demo", devDependencies: { typescript: "~6.0.3" } });
  });

  it("replaces arrays instead of concatenating them", () => {
    const merged = mergePackageJson({ files: ["a"] }, { files: ["b"] });

    expect(merged).toEqual({ files: ["b"] });
  });
});
