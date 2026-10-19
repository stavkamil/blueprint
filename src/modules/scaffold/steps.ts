import { mkdir } from "node:fs/promises";

import type { CommandResult } from "../../lib/run-command.ts";
import { ProjectType } from "../../utils/template/project-type.ts";
import { renderTemplate } from "../../utils/template/render-template.ts";
import { scaffoldNextjs } from "./scaffold-nextjs.ts";
import {
  type Problem,
  type Step,
  type StepContext,
  StepId,
  type StepOutcome,
  Visibility,
} from "./types.ts";
import { writeProjectFiles } from "./write-project-files.ts";

const issuesUrl = "https://github.com/stavkamil/blueprint/issues";
const verifyScripts = ["lint", "typecheck", "test", "build"];

const outputOf = (result: CommandResult): string => `${result.stdout}${result.stderr}`.trim();

const keptFolder = (dir: string): string =>
  `Not resumable. The folder ${dir} is kept for inspection; delete it before running blueprint new again.`;

const commandFailed = (command: string, result: CommandResult, dir: string): Problem => ({
  message: `\`${command}\` failed.`,
  hint: keptFolder(dir),
  output: outputOf(result),
});

const scaffold = async (context: StepContext): Promise<Problem | undefined> => {
  const files = await renderTemplate(context.options.template);
  if (context.options.template.type === ProjectType.Nextjs) {
    return scaffoldNextjs(context, files);
  }
  await mkdir(context.dir, { recursive: true });
  await writeProjectFiles(context.dir, files);
  return undefined;
};

const initGit = async ({ dir, run }: StepContext): Promise<Problem | undefined> => {
  const result = await run("git", ["init", "--initial-branch=main"], { cwd: dir });
  return result.exitCode === 0 ? undefined : commandFailed("git init", result, dir);
};

const install = async ({ dir, run }: StepContext): Promise<Problem | undefined> => {
  // CI environments default to a frozen lockfile, and a new project has no lockfile yet.
  const result = await run("pnpm", ["install", "--no-frozen-lockfile"], { cwd: dir });
  return result.exitCode === 0 ? undefined : commandFailed("pnpm install", result, dir);
};

const verify = async ({ dir, run }: StepContext): Promise<Problem | undefined> => {
  for (const script of verifyScripts) {
    const result = await run("pnpm", [script], { cwd: dir });
    if (result.exitCode !== 0) {
      return {
        message: `\`pnpm ${script}\` failed on the fresh project. This is a blueprint bug, so no GitHub repo was created.`,
        hint: `${keptFolder(dir)} Please report it with the output below: ${issuesUrl}`,
        output: outputOf(result),
      };
    }
  }
  return undefined;
};

const commit = async ({ options, dir, run }: StepContext): Promise<Problem | undefined> => {
  const added = await run("git", ["add", "--all"], { cwd: dir });
  if (added.exitCode !== 0) {
    return commandFailed("git add", added, dir);
  }
  const message = `chore: initial commit from blueprint v${options.template.blueprintVersion}`;
  const committed = await run("git", ["commit", "--message", message], { cwd: dir });
  return committed.exitCode === 0 ? undefined : commandFailed("git commit", committed, dir);
};

/** gh prints the new repo's URL first, then git's push output. */
const repoUrlLine = /^https:\/\/github\.com\//u;

const toRepoUrl = (remote: string): string => remote.trim().replace(/\.git$/u, "");

/** Creates the repo and pushes, or, when `origin` already exists (a resumed run), only pushes. */
const createRepo = async ({ options, dir, run }: StepContext): Promise<Problem | string> => {
  const origin = await run("git", ["remote", "get-url", "origin"], { cwd: dir });
  const { projectName, description } = options.template;
  const result =
    origin.exitCode === 0
      ? await run("git", ["push", "--set-upstream", "origin", "main"], { cwd: dir })
      : await run(
          "gh",
          [
            "repo",
            "create",
            projectName,
            `--${options.visibility}`,
            "--description",
            description,
            "--source",
            ".",
            "--push",
          ],
          { cwd: dir },
        );
  if (result.exitCode !== 0) {
    return {
      message:
        origin.exitCode === 0
          ? "Pushing main to GitHub failed."
          : "Creating the GitHub repo failed.",
      hint: `The project is committed locally at ${dir}. Check \`gh auth status\` and your network, then resume.`,
      output: outputOf(result),
    };
  }
  return origin.exitCode === 0
    ? toRepoUrl(origin.stdout)
    : (result.stdout
        .split("\n")
        .find((line) => repoUrlLine.test(line))
        ?.trim() ?? "");
};

const never = (): boolean => false;

/** The steps after preflight, in order. The runner stops at the first failure; nothing touches GitHub before verify passes. */
export const scaffoldSteps: readonly Step[] = [
  {
    id: StepId.Scaffold,
    title: (options) => `Scaffolded (${options.template.type})`,
    isSkipped: never,
    run: async (context) => ({ problem: await scaffold(context) }),
  },
  {
    id: StepId.InitGit,
    title: () => "Initialized git on main",
    isSkipped: never,
    run: async (context) => ({ problem: await initGit(context) }),
  },
  {
    id: StepId.Install,
    title: () => "Installed dependencies and git hooks",
    isSkipped: never,
    run: async (context) => ({ problem: await install(context) }),
  },
  {
    id: StepId.Verify,
    title: () => "Verified: lint, typecheck, test and build pass",
    isSkipped: never,
    run: async (context) => ({ problem: await verify(context) }),
  },
  {
    id: StepId.Commit,
    title: () => "Committed (hooks and secret scan passed)",
    isSkipped: never,
    run: async (context) => ({ problem: await commit(context) }),
  },
  {
    id: StepId.CreateRepo,
    title: (options) =>
      `Created the ${options.visibility === Visibility.Public ? "public" : "private"} GitHub repo and pushed main`,
    isSkipped: (options) => !options.github,
    run: async (context: StepContext): Promise<StepOutcome> => {
      const outcome = await createRepo(context);
      return typeof outcome === "string" ? { url: outcome } : { problem: outcome };
    },
  },
];
