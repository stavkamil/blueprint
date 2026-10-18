import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import { readDependencyRanges } from "./read-dependency-ranges.ts";

const writePackageJson = async (content: unknown): Promise<URL> => {
  const dir = await mkdtemp(join(tmpdir(), "blueprint-ranges-"));
  const path = join(dir, "package.json");
  await writeFile(path, JSON.stringify(content));
  return pathToFileURL(path);
};

describe("readDependencyRanges", () => {
  it("combines dependencies and devDependencies", async () => {
    const url = await writePackageJson({
      dependencies: { "typescript-eslint": "^8.0.0" },
      devDependencies: { vitest: "^5.0.0" },
    });

    const ranges = await readDependencyRanges(url);

    expect(ranges).toEqual({ "typescript-eslint": "^8.0.0", vitest: "^5.0.0" });
  });

  it("returns nothing for a package.json without dependencies", async () => {
    const url = await writePackageJson({ name: "empty" });

    const ranges = await readDependencyRanges(url);

    expect(ranges).toEqual({});
  });
});
