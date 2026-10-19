import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

import { type RunCommand, runCommand } from "../lib/run-command.ts";
import { formatDoctorReport } from "../modules/doctor/format-doctor-report.ts";
import { runDoctor } from "../modules/doctor/run-doctor.ts";
import type { DoctorResult } from "../modules/doctor/types.ts";
import { runPreflight } from "../modules/scaffold/preflight.ts";
import { runScaffold } from "../modules/scaffold/run-scaffold.ts";
import { scaffoldSteps } from "../modules/scaffold/steps.ts";
import {
  type Problem,
  type ScaffoldResult,
  StepId,
  StepStatus,
  Visibility,
} from "../modules/scaffold/types.ts";
import { BlueprintError } from "../utils/errors.ts";
import { quoteForShell } from "../utils/quote-for-shell.ts";
import { readDependencyRanges } from "../utils/read-dependency-ranges.ts";
import { deriveTemplateOptions } from "../utils/template/derive-template-options.ts";
import { ProjectType } from "../utils/template/project-type.ts";
import type { TemplateOptions } from "../utils/template/types.ts";
import { readPackageVersion } from "../utils/version.ts";
import type { Io } from "./main.ts";

/** What `blueprint new` reads from its surroundings; tests replace all of it. */
export type NewEnvironment = {
  readonly run: RunCommand;
  readonly cwd: string;
  readonly nodeVersion: string;
  /** Secures the new repo; `blueprint doctor --fix` by default. */
  readonly secure?: (dir: string) => Promise<DoctorResult>;
};

const packageJsonUrl = new URL("../../package.json", import.meta.url);
const outputTailLines = 40;
const exitFailed = 1;
const exitRefused = 2;
const secureStepId = "secure";
/** Failures at or after these steps leave a committed project that `--resume` can finish. */
const resumableSteps: readonly string[] = [StepId.CreateRepo, secureStepId];

const usage = [
  'Usage: blueprint new <name> --description "<one line>" [options]',
  "       blueprint new <name> --resume [--dir <parent>]",
  "",
  "Creates a project, verifies it, commits it, pushes it to a new private GitHub repo and secures the repo",
  "(ruleset, merge settings, Actions permissions, Dependabot, secrets from the macOS Keychain).",
  "",
  "Options:",
  "  --description <text>  One line for AGENTS.md, the README, package.json and GitHub (required)",
  "  --type ts|nextjs      Project type (default: ts)",
  "  --release             Add release-please releases",
  "  --public              Create a public repo (default: private)",
  "  --no-github           Stop after the local commit",
  "  --resume              Finish a run that stopped at or after creating the repo",
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
      resume: { type: "boolean", default: false },
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

const readTemplateBase = async (): Promise<{
  readonly blueprintVersion: string;
  readonly versions: TemplateOptions["versions"];
}> => {
  const blueprintVersion = await readPackageVersion(packageJsonUrl);
  const ranges = await readDependencyRanges(packageJsonUrl);
  return {
    blueprintVersion,
    versions: { ...ranges, "@stavkamil/blueprint": `^${blueprintVersion}` },
  };
};

/** Why a resumed run can't start, or undefined when it can. */
const checkResumable = async (dir: string, run: RunCommand): Promise<Problem | undefined> => {
  const head = await run("git", ["rev-parse", "--verify", "HEAD"], { cwd: dir });
  if (head.exitCode !== 0) {
    return {
      message: `Nothing to resume in ${dir}: there's no committed blueprint project there.`,
      hint: "Delete the folder and run blueprint new again without --resume.",
    };
  }
  const auth = await run("gh", ["auth", "status"]);
  return auth.exitCode === 0
    ? undefined
    : {
        message: "The GitHub CLI isn't installed or isn't logged in.",
        hint: "Install it (brew install gh), then run: gh auth login",
      };
};

const doctorProblem = (doctor: DoctorResult): Problem => ({
  message: "The repo was created, but securing it needs a few steps only you can do.",
  hint: "Do the steps above, then resume.",
  output: formatDoctorReport(doctor).join("\n"),
});

/**
 * `blueprint new`: preflight, the scaffold steps, then `blueprint doctor --fix` to secure the repo. Never prompts,
 * so the skill, a script or a person can run it.
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
  const parentDir = resolve(environment.cwd, values.dir);
  const dir = join(parentDir, projectName);
  const dirFlag = parentDir === environment.cwd ? "" : ` --dir ${quoteForShell(parentDir)}`;
  const resumeCommand = `blueprint new ${projectName} --resume${dirFlag}`;
  const { run } = environment;

  const refuse = (problems: readonly Problem[], projectType: string): number => {
    if (values.json) {
      const project = { name: projectName, dir, type: projectType };
      io.stdout(JSON.stringify({ ok: false, resumable: false, project, steps: [], problems }));
    } else {
      problems.forEach((problem) => {
        printProblem(io, problem);
      });
    }
    return exitRefused;
  };

  let template: TemplateOptions;
  let steps = scaffoldSteps;
  if (values.resume) {
    const derived = await deriveTemplateOptions(dir);
    const blocked =
      derived === undefined
        ? { message: `Nothing to resume in ${dir}.`, hint: "Check the name and --dir." }
        : await checkResumable(dir, run);
    if (derived === undefined || blocked !== undefined) {
      return refuse(blocked === undefined ? [] : [blocked], derived?.type ?? "");
    }
    const pnpmVersion = (await run("pnpm", ["--version"])).stdout.trim();
    template = { ...derived, ...(await readTemplateBase()), pnpmVersion };
    steps = scaffoldSteps.filter((step) => step.id === StepId.CreateRepo);
  } else {
    if (values.description === undefined || values.description.trim() === "") {
      throw usageError("--description is required.");
    }
    if (type === undefined) {
      throw usageError(`Unknown --type '${values.type}'. Use ts or nextjs.`);
    }
    const preflight = await runPreflight(
      { projectName, parentDir, github: values.github, nodeVersion: environment.nodeVersion },
      run,
    );
    if (preflight.problems.length > 0) {
      return refuse(preflight.problems, type);
    }
    template = {
      projectName,
      description: values.description.trim(),
      type,
      release: values.release,
      ...(await readTemplateBase()),
      pnpmVersion: preflight.pnpmVersion,
    };
  }

  const progress = (title: string): void => {
    if (!values.json) {
      io.stdout(`✓ ${title}`);
    }
  };
  const scaffold: ScaffoldResult = await runScaffold(
    {
      template,
      parentDir,
      visibility: values.public ? Visibility.Public : Visibility.Private,
      github: values.github || values.resume,
    },
    run,
    progress,
    steps,
  );

  let doctor: DoctorResult | undefined;
  let problem = scaffold.problem;
  const isSecuring = scaffold.ok && (values.github || values.resume);
  if (isSecuring) {
    const secure =
      environment.secure ??
      ((projectDir: string) => runDoctor({ dir: projectDir, fix: true, run }));
    doctor = await secure(scaffold.dir);
    if (doctor.ok) {
      progress(
        "Secured the repo: ruleset, merge settings, Actions permissions, Dependabot, secrets",
      );
    } else {
      problem = doctorProblem(doctor);
    }
  }
  const secureStatus = isSecuring
    ? doctor?.ok === true
      ? StepStatus.Done
      : StepStatus.Failed
    : scaffold.ok
      ? StepStatus.Skipped
      : StepStatus.Pending;
  const allSteps = [...scaffold.steps, { id: secureStepId, status: secureStatus }];
  const isOk = problem === undefined;
  const failedStep = allSteps.find((step) => step.status === StepStatus.Failed)?.id;
  const isResumable = !isOk && failedStep !== undefined && resumableSteps.includes(failedStep);

  if (values.json) {
    const manualSteps =
      doctor?.checks.flatMap((check) =>
        check.status === "fail" && check.action !== undefined ? [check.action] : [],
      ) ?? [];
    io.stdout(
      JSON.stringify({
        ok: isOk,
        resumable: isResumable,
        project: {
          name: template.projectName,
          dir: scaffold.dir,
          type: template.type,
          url: scaffold.url,
        },
        steps: allSteps,
        problems: problem === undefined ? [] : [problem],
        doctor,
        manualSteps,
        resumeCommand: isResumable ? resumeCommand : undefined,
      }),
    );
  } else if (problem === undefined) {
    io.stdout("");
    io.stdout(`Project: ${scaffold.dir}`);
    if (scaffold.url !== undefined) {
      io.stdout(`Repo: ${scaffold.url}`);
    }
    io.stdout(`Next: cd ${quoteForShell(scaffold.dir)} && claude`);
  } else {
    printProblem(io, problem);
    if (isResumable) {
      io.stderr(`  → ${resumeCommand}`);
    }
  }
  return isOk ? 0 : exitFailed;
};
