import { readdir } from "node:fs/promises";
import { join } from "node:path";

import type { RunCommand } from "../../lib/run-command.ts";
import { minimumNodeVersion } from "./constants.ts";
import type { Problem } from "./types.ts";

/** What preflight checks: enough to refuse before anything is created. */
export type PreflightRequest = {
  readonly projectName: string;
  readonly parentDir: string;
  readonly github: boolean;
  /** The running Node version, e.g. `24.1.0`. */
  readonly nodeVersion: string;
};

/** Preflight's answer: every problem found, and the pnpm version to record in the project. */
export type PreflightResult = {
  readonly problems: readonly Problem[];
  readonly pnpmVersion: string;
};

const maxNameLength = 100;
const kebabCase = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const repoNotFound = /could not resolve to a repository/iu;

const checkName = (projectName: string): Problem | undefined =>
  kebabCase.test(projectName) && projectName.length <= maxNameLength
    ? undefined
    : {
        message: `'${projectName}' isn't a valid project name.`,
        hint: "Use kebab-case: lowercase letters, digits and single dashes, up to 100 characters (e.g. my-app).",
      };

const checkFolder = async (dir: string): Promise<Problem | undefined> => {
  const entries = await readdir(dir).catch(() => []);
  return entries.length === 0
    ? undefined
    : {
        message: `The folder ${dir} already exists and isn't empty.`,
        hint: "Pick another name, or run from a different folder with --dir.",
      };
};

const checkNode = (nodeVersion: string): Problem | undefined => {
  const [major = 0, minor = 0] = nodeVersion.split(".").map(Number);
  const [minMajor, minMinor] = minimumNodeVersion;
  const isRecent = major > minMajor || (major === minMajor && minor >= minMinor);
  return isRecent
    ? undefined
    : {
        message: `Node ${nodeVersion} is too old.`,
        hint: `Install Node ${String(minMajor)}.${String(minMinor)} or newer (blueprint projects use Node 24).`,
      };
};

const checkTool = async (
  run: RunCommand,
  command: string,
  args: readonly string[],
  hint: string,
): Promise<{ readonly problem?: Problem; readonly stdout: string }> => {
  const result = await run(command, args);
  return result.exitCode === 0
    ? { stdout: result.stdout.trim() }
    : { problem: { message: `\`${command}\` isn't installed or doesn't work.`, hint }, stdout: "" };
};

const checkGitIdentity = async (run: RunCommand): Promise<Problem | undefined> => {
  const name = await run("git", ["config", "user.name"]);
  const email = await run("git", ["config", "user.email"]);
  return name.stdout.trim() !== "" && email.stdout.trim() !== ""
    ? undefined
    : {
        message: "git has no user name or email, so it can't commit.",
        hint: 'Set them: git config --global user.name "Your Name" && git config --global user.email you@example.com',
      };
};

const checkGithub = async (run: RunCommand, projectName: string): Promise<Problem | undefined> => {
  const auth = await run("gh", ["auth", "status"]);
  if (auth.exitCode !== 0) {
    return {
      message: "The GitHub CLI isn't installed or isn't logged in.",
      hint: "Install it (brew install gh), then run: gh auth login. Or pass --no-github to stay local.",
    };
  }
  const repo = await run("gh", ["repo", "view", projectName, "--json", "name"]);
  if (repo.exitCode === 0) {
    return {
      message: `You already have a GitHub repo named ${projectName}.`,
      hint: "Pick another name. blueprint never reuses or deletes an existing repo.",
    };
  }
  return repoNotFound.test(repo.stderr)
    ? undefined
    : {
        message: `Couldn't check whether the GitHub repo ${projectName} exists.`,
        hint: "Check your network and `gh auth status`, then try again.",
      };
};

/**
 * Checks everything `blueprint new` needs before it creates anything, and reports every problem at once with its fix.
 * @param request the project name, where it goes, and whether GitHub is involved
 * @param run runs external commands; tests pass a fake
 */
export const runPreflight = async (
  request: PreflightRequest,
  run: RunCommand,
): Promise<PreflightResult> => {
  const name = checkName(request.projectName);
  if (name !== undefined) {
    return { problems: [name], pnpmVersion: "" };
  }
  const pnpm = await checkTool(run, "pnpm", ["--version"], "Install pnpm: corepack enable pnpm");
  const git = await checkTool(run, "git", ["--version"], "Install git: xcode-select --install");
  const gitleaks = await checkTool(
    run,
    "gitleaks",
    ["version"],
    "Install gitleaks (the commit hook scans for secrets): brew install gitleaks",
  );
  const problems = [
    await checkFolder(join(request.parentDir, request.projectName)),
    checkNode(request.nodeVersion),
    pnpm.problem,
    git.problem,
    git.problem === undefined ? await checkGitIdentity(run) : undefined,
    gitleaks.problem,
    request.github ? await checkGithub(run, request.projectName) : undefined,
  ].filter((problem) => problem !== undefined);
  return { problems, pnpmVersion: pnpm.stdout };
};
