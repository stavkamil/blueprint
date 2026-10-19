import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { deriveTemplateOptions } from "./derive-template-options.ts";

const makeProject = async (pkg: unknown, isRelease = false): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), "blueprint-derive-"));
  await writeFile(join(dir, "package.json"), JSON.stringify(pkg));
  if (isRelease) {
    await writeFile(join(dir, "release-please-config.json"), "{}");
  }
  return dir;
};

describe("deriveTemplateOptions", () => {
  it("reads a ts project's options", async () => {
    const dir = await makeProject({ name: "demo", description: "A demo" });

    const options = await deriveTemplateOptions(dir);

    expect(options).toEqual({
      projectName: "demo",
      description: "A demo",
      type: "ts",
      release: false,
    });
  });

  it("detects nextjs from the next dependency and release from release-please", async () => {
    const dir = await makeProject({ name: "web", dependencies: { next: "16.4.2" } }, true);

    const options = await deriveTemplateOptions(dir);

    expect(options).toMatchObject({ type: "nextjs", release: true, description: "" });
  });

  it("returns undefined without a named package.json", async () => {
    const empty = await mkdtemp(join(tmpdir(), "blueprint-derive-"));
    const unnamed = await makeProject({ private: true });

    expect(await deriveTemplateOptions(empty)).toBeUndefined();
    expect(await deriveTemplateOptions(unnamed)).toBeUndefined();
  });
});
