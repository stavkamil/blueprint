import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ProjectType } from "../../../utils/template/project-type.ts";
import { type ScaffoldOptions, Visibility } from "../types.ts";

/**
 * Builds scaffold options for a project in a fresh temp folder, with every dependency version filled in.
 * @param overrides the fields a test is about
 */
export const makeScaffoldOptions = async (
  overrides: Partial<ScaffoldOptions> = {},
): Promise<ScaffoldOptions> => ({
  template: {
    projectName: "demo",
    description: "A demo project",
    type: ProjectType.Ts,
    release: false,
    blueprintVersion: "1.2.3",
    versions: Object.fromEntries(
      [
        "@stavkamil/blueprint",
        "@types/node",
        "@vitest/coverage-v8",
        "eslint",
        "lefthook",
        "prettier",
        "typescript",
        "vitest",
        "zod",
      ].map((name) => [name, "^1.0.0"]),
    ),
    pnpmVersion: "12.11.2",
  },
  parentDir: await mkdtemp(join(tmpdir(), "blueprint-scaffold-")),
  visibility: Visibility.Private,
  github: true,
  ...overrides,
});
