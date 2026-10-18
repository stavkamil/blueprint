import { describe, expect, it } from "vitest";

import { sortDependencies } from "./sort-dependencies.ts";

describe("sortDependencies", () => {
  it("sorts dependency lists by name and leaves other fields in place", () => {
    const pkg = {
      name: "demo",
      scripts: { test: "vitest", build: "tsc" },
      devDependencies: { vitest: "^5", "@types/node": "^24", eslint: "^10" },
    };

    const sorted = sortDependencies(pkg);

    expect(Object.keys(sorted.devDependencies ?? {})).toEqual(["@types/node", "eslint", "vitest"]);
    expect(Object.keys(sorted.scripts ?? {})).toEqual(["test", "build"]);
  });
});
