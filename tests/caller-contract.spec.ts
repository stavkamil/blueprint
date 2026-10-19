// The CI caller files a project gets must match the contract in SPEC-ci-workflows (SPEC-project-template criterion 7).
// Comment lines are ignored, so the files can explain themselves.
import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { ProjectType } from "../src/utils/template/project-type.ts";
import { renderTemplate } from "../src/utils/template/render-template.ts";
import { extractCodeBlocks } from "./support/code-blocks.ts";

const specUrl = new URL("../docs/specs/SPEC-ci-workflows.md", import.meta.url);
const callerPaths = [
  ".github/workflows/ci.yml",
  ".github/workflows/ai-review.yml",
  ".github/workflows/release.yml",
];

const withoutComments = (yaml: string): string =>
  yaml
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("#"))
    .join("\n")
    .trim();

describe("CI caller files", () => {
  it.each(callerPaths)("%s matches the spec's contract", async (path) => {
    const spec = await readFile(specUrl, "utf8");
    const contract = extractCodeBlocks(spec).find((block) => block.code.startsWith(`# ${path}`));
    const files = await renderTemplate({
      projectName: "demo",
      description: "Demo",
      type: ProjectType.Ts,
      release: true,
      blueprintVersion: "1.4.0",
      // Every dependency gets the same range; only the workflow files matter here.
      versions: new Proxy({}, { get: () => "^1.0.0" }),
      pnpmVersion: "12.11.2",
    });

    const rendered = files.get(path) ?? "";

    expect(withoutComments(rendered)).toBe(withoutComments(contract?.code ?? "missing"));
  });
});
