import { createGhApi, type GhApi } from "../../lib/gh-api.ts";
import type { RunCommand } from "../../lib/run-command.ts";
import { createGithubContext } from "./create-github-context.ts";
import { doctorChecks } from "./doctor-checks.ts";
import { parseGithubRemote } from "./parse-github-remote.ts";
import {
  type Check,
  type CheckReport,
  type CheckResult,
  CheckStatus,
  type DoctorResult,
  type Finding,
  type GithubContext,
  type GithubRepo,
  type LocalContext,
  Scope,
} from "./types.ts";

/** What a doctor run needs. */
export type DoctorOptions = {
  readonly dir: string;
  /** Repair what's fixable, then check again. */
  readonly fix: boolean;
  readonly run: RunCommand;
  /** Defaults to `gh api` through `run`. */
  readonly ghApi?: GhApi;
  readonly checks?: readonly Check[];
};

const blockedResult = (blocked: Finding): DoctorResult => ({
  ok: false,
  blocked,
  isLocalOnly: false,
  checks: [],
  fixed: [],
});

const runCheck = (
  check: Check,
  local: LocalContext,
  github: GithubContext | undefined,
): Promise<CheckResult> => {
  if (check.scope === Scope.Local) {
    return check.run(local);
  }
  return github === undefined
    ? Promise.resolve({ status: CheckStatus.Skipped })
    : check.run(github);
};

const fixCheck = (
  check: Check,
  local: LocalContext,
  github: GithubContext | undefined,
): Promise<Finding | undefined> => {
  if (check.scope === Scope.Local) {
    return check.fix?.(local) ?? Promise.resolve(undefined);
  }
  return github === undefined
    ? Promise.resolve(undefined)
    : (check.fix?.(github) ?? Promise.resolve(undefined));
};

const findRepo = async (
  dir: string,
  run: RunCommand,
): Promise<{ readonly repo?: GithubRepo; readonly blocked?: Finding }> => {
  const inRepo = await run("git", ["rev-parse", "--is-inside-work-tree"], { cwd: dir });
  if (inRepo.exitCode !== 0) {
    return {
      blocked: {
        title: `${dir} isn't a git repository`,
        why: "doctor checks a project's git hooks and its GitHub repo.",
        action: "Run blueprint doctor inside a blueprint project",
      },
    };
  }
  const origin = await run("git", ["remote", "get-url", "origin"], { cwd: dir });
  const repo = origin.exitCode === 0 ? parseGithubRemote(origin.stdout) : undefined;
  if (repo === undefined) {
    return {};
  }
  const auth = await run("gh", ["auth", "status"]);
  return auth.exitCode === 0
    ? { repo }
    : {
        blocked: {
          title: "The GitHub CLI isn't installed or isn't logged in",
          why: `doctor reads and fixes ${repo.owner}/${repo.name} through gh.`,
          action: "brew install gh, then gh auth login",
        },
      };
};

/**
 * Checks the project locally and on GitHub; with `fix`, repairs what it can and checks again. Each check's result
 * comes with the exact next step, so a person or an agent can act on it.
 * @param options the project folder, whether to fix, and the command runner
 */
export const runDoctor = async (options: DoctorOptions): Promise<DoctorResult> => {
  const { dir, run } = options;
  const checks = options.checks ?? doctorChecks;
  const ghApi = options.ghApi ?? createGhApi(run);
  const { repo, blocked } = await findRepo(dir, run);
  if (blocked !== undefined) {
    return blockedResult(blocked);
  }
  const local: LocalContext = { dir, run };
  const makeGithub = (): GithubContext | undefined =>
    repo === undefined ? undefined : createGithubContext(dir, repo, run, ghApi);

  const evaluate = (github: GithubContext | undefined): Promise<readonly CheckResult[]> =>
    Promise.all(checks.map((check) => runCheck(check, local, github)));

  const firstGithub = makeGithub();
  let results = await evaluate(firstGithub);
  const fixed: string[] = [];
  const unfixable = new Map<string, Finding>();
  if (options.fix) {
    for (const [index, check] of checks.entries()) {
      if (results[index]?.status !== CheckStatus.Fail || check.fix === undefined) {
        continue;
      }
      const finding = await fixCheck(check, local, firstGithub);
      if (finding === undefined) {
        fixed.push(check.name);
      } else {
        unfixable.set(check.id, finding);
      }
    }
    if (fixed.length > 0 || unfixable.size > 0) {
      results = await evaluate(makeGithub());
    }
  }

  const reports: CheckReport[] = checks.map((check, index) => {
    const result = results[index] ?? { status: CheckStatus.Skipped };
    const base = { id: check.id, name: check.name, status: result.status };
    if (result.status !== CheckStatus.Fail) {
      return base;
    }
    const { title, why, action } = unfixable.get(check.id) ?? result;
    return { ...base, title, why, action };
  });
  return {
    ok: reports.every((report) => report.status !== CheckStatus.Fail),
    isLocalOnly: repo === undefined,
    checks: reports,
    fixed,
  };
};
