import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

import { type RunCommand, runCommand } from "../lib/run-command.ts";
import { runPreflight } from "../modules/scaffold/preflight.ts";
import { runScaffold } from "../modules/scaffold/run-scaffold.ts";
import { type Problem, type ScaffoldResult, Visibility } from "../modules/scaffold/types.ts";
import { BlueprintError } from "../utils/errors.ts";
import { readDependencyRanges } from "../utils/read-dependency-ranges.ts";
import { ProjectType } from "../utils/template/project-type.ts";
import { readPackageVersion } from "../utils/version.ts";
import type { Io } from "./main.ts";

/** What `blueprint new` reads from its surroundings; tests replace all of it. */
export type NewEnvironment = {
  readonly run: RunCommand;
  readonly cwd: string;
  readonly nodeVersion: string;
};

const packageJsonUrl = new URL("../../package.json", import.meta.url);
const outputTailLines = 40;
const exitFailed = 1;
const exitRefused = 2;

const usage = [
  'Usage: blueprint new <name> --description "<one line>" [options]',
  "",
  "Creates a project, verifies it, commits it and pushes it to a new private GitHub repo.",
  "",
  "Options:",
  "  --description <text>  One line for AGENTS.md, the README, package.json and GitHub (required)",
  "  --type ts|nextjs      Project type (default: ts)",
  "  --release             Add release-please releases",
  "  --public              Create a public repo (default: private)",
  "  --no-github           Stop after the local commit",
  "  --dir <parent>        Create the project inside this folder (default: current folder)",
  "  --json                Print one JSON result instead of progress lines",
].join("\n");

const usageError = (message: string): BlueprintError =>
  new BlueprintError(message, "Run `blueprint new --help` for the options.");

const parseNewArgs = (argv: readonly string[], cwd: string) => {
  const { values, positionals } = parseArgs({
    args: [...argv],
    options: {
      description: { type: "string" },
      type: { type: "string", default: ProjectType.Ts },
      release: { type: "boolean", default: false },
      public: { type: "boolean", default: false },
      github: { type: "boolean", default: true },
      dir: { type: "string", default: cwd },
      json: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
    allowPositionals: true,
    allowNegative: true,
    strict: true,
  });
  const [projectName, ...extra] = positionals;
  const type = Object.values(ProjectType).find((candidate) => candidate === values.type);
  return { values, projectName, extra, type };
};

const tail = (output: string): string => output.split("\n").slice(-outputTailLines).join("\n");

const printProblem = (io: Io, problem: Problem): void => {
  io.stderr(`✗ ${problem.message}`);
  if (problem.output !== undefined && problem.output !== "") {
    io.stderr(tail(problem.output));
  }
  io.stderr(`  ${problem.hint}`);
};

const printSummary = (io: Io, result: ScaffoldResult): void => {
  io.stdout("");
  io.stdout(`Project: ${result.dir}`);
  if (result.url !== undefined) {
    io.stdout(`Repo: ${result.url}`);
  }
  io.stdout(`Next: cd ${result.dir} && claude`);
};

/**
 * `blueprint new`: preflight, then the scaffold steps. Never prompts, so the skill, a script or a person can run it.
 * Exit codes: 0 created, 1 failed after creating something, 2 refused before creating anything.
 * @param argv the arguments after `new`
 * @param io where output goes
 * @param environment the command runner, current folder and Node version
 */
export const runNew = async (
  argv: readonly string[],
  io: Io,
  environment: NewEnvironment = {
    run: runCommand,
    cwd: process.cwd(),
    nodeVersion: process.versions.node,
  },
): Promise<number> => {
  const { values, projectName, extra, type } = parseNewArgs(argv, environment.cwd);
  if (values.help) {
    io.stdout(usage);
    return 0;
  }
  if (projectName === undefined || extra.length > 0) {
    throw usageError("Give exactly one project name.");
  }
  if (values.description === undefined || values.description.trim() === "") {
    throw usageError("--description is required.");
  }
  if (type === undefined) {
    throw usageError(`Unknown --type '${values.type}'. Use ts or nextjs.`);
  }

  const parentDir = resolve(environment.cwd, values.dir);
  const project = { name: projectName, dir: join(parentDir, projectName), type };
  const preflight = await runPreflight(
    {
      projectName,
      parentDir,
      github: values.github,
      nodeVersion: environment.nodeVersion,
    },
    environment.run,
  );
  if (preflight.problems.length > 0) {
    if (values.json) {
      io.stdout(JSON.stringify({ ok: false, project, steps: [], problems: preflight.problems }));
    } else {
      preflight.problems.forEach((problem) => {
        printProblem(io, problem);
      });
    }
    return exitRefused;
  }

  const blueprintVersion = await readPackageVersion(packageJsonUrl);
  const ranges = await readDependencyRanges(packageJsonUrl);
  const result = await runScaffold(
    {
      template: {
        projectName,
        description: values.description.trim(),
        type,
        release: values.release,
        blueprintVersion,
        versions: { ...ranges, "@stavkamil/blueprint": `^${blueprintVersion}` },
        pnpmVersion: preflight.pnpmVersion,
      },
      parentDir,
      visibility: values.public ? Visibility.Public : Visibility.Private,
      github: values.github,
    },
    environment.run,
    (title) => {
      if (!values.json) {
        io.stdout(`✓ ${title}`);
      }
    },
  );

  if (values.json) {
    const problems = result.problem === undefined ? [] : [result.problem];
    io.stdout(
      JSON.stringify({
        ok: result.ok,
        project: { ...project, dir: result.dir, url: result.url },
        steps: result.steps,
        problems,
      }),
    );
  } else if (result.problem === undefined) {
    printSummary(io, result);
  } else {
    printProblem(io, result.problem);
  }
  return result.ok ? 0 : exitFailed;
};
