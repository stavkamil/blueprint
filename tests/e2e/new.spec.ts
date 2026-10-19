// Creates real projects with the packed blueprint tarball, the way `blueprint new --no-github` does, and checks
// that each passes its own lint, typecheck, test and build (the verify step) and commits with its hooks installed.
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runCommand } from "../../src/lib/run-command.ts";
import { runScaffold } from "../../src/modules/scaffold/run-scaffold.ts";
import { Visibility } from "../../src/modules/scaffold/types.ts";
import { readDependencyRanges } from "../../src/utils/read-dependency-ranges.ts";
import { ProjectType } from "../../src/utils/template/project-type.ts";
import { readPackageVersion } from "../../src/utils/version.ts";

const root = new URL("../../", import.meta.url);
const packageJsonUrl = new URL("package.json", root);

let workDir = "";
let tarball = "";

const git = async (dir: string, args: readonly string[]): Promise<string> =>
  (await runCommand("git", args, { cwd: dir })).stdout.trim();

const createProject = async (type: ProjectType) => {
  const version = await readPackageVersion(packageJsonUrl);
  const ranges = await readDependencyRanges(packageJsonUrl);
  const pnpmVersion = (await runCommand("pnpm", ["--version"])).stdout.trim();
  const result = await runScaffold(
    {
      template: {
        projectName: `e2e-${type}`,
        description: `End-to-end ${type} project`,
        type,
        release: true,
        blueprintVersion: version,
        versions: { ...ranges, "@stavkamil/blueprint": `file:${tarball}` },
        pnpmVersion,
      },
      parentDir: workDir,
      visibility: Visibility.Private,
      github: false,
    },
    runCommand,
  );
  if (!result.ok) {
    throw new Error(
      `${result.problem?.message ?? "failed"}\n${result.problem?.output ?? ""}\n${result.problem?.hint ?? ""}`,
    );
  }
  return result;
};

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), "blueprint-e2e-"));
  const packed = await runCommand("pnpm", ["pack", "--pack-destination", workDir], {
    cwd: root.pathname,
  });
  tarball = packed.stdout.trim().split("\n").at(-1) ?? "";
});

afterAll(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe.each([ProjectType.Ts, ProjectType.Nextjs])("blueprint new --type %s", (type) => {
  it("creates a project that passes its own checks and commits once on main", async () => {
    const result = await createProject(type);

    expect(await git(result.dir, ["branch", "--show-current"])).toBe("main");
    expect(await git(result.dir, ["log", "--format=%s"])).toMatch(
      /^chore: initial commit from blueprint v\d+\.\d+\.\d+$/u,
    );
    expect(await git(result.dir, ["status", "--porcelain"])).toBe("");
    await access(join(result.dir, ".git", "hooks", "pre-commit"));

    const agents = await readFile(join(result.dir, "AGENTS.md"), "utf8");
    expect(agents).toContain("<!-- BEGIN:blueprint-standards -->");
    expect(agents.includes("<!-- BEGIN:nextjs-agent-rules -->")).toBe(type === ProjectType.Nextjs);
  });
});
