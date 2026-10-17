import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import { BlueprintError } from "./errors.ts";
import { readPackageVersion } from "./version.ts";

const writePackageJson = async (content: string): Promise<URL> => {
  const dir = await mkdtemp(join(tmpdir(), "blueprint-version-"));
  const file = join(dir, "package.json");
  await writeFile(file, content);
  return pathToFileURL(file);
};

describe("readPackageVersion", () => {
  it("returns the version field", async () => {
    const url = await writePackageJson(JSON.stringify({ version: "1.2.3" }));

    const version = await readPackageVersion(url);

    expect(version).toBe("1.2.3");
  });

  it("throws a BlueprintError with a hint when the version is missing", async () => {
    const url = await writePackageJson(JSON.stringify({ name: "x" }));

    const result = readPackageVersion(url);

    await expect(result).rejects.toBeInstanceOf(BlueprintError);
    await expect(result).rejects.toMatchObject({ hint: expect.stringContaining("Reinstall") });
  });
});
