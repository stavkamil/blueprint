import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { GhApi, GhApiResult } from "../../../lib/gh-api.ts";
import type { CommandResult, RunCommand } from "../../../lib/run-command.ts";
import {
  expectedMergeSettings,
  expectedRuleset,
  expectedWorkflowPermissions,
} from "../constants.ts";

const repoPath = "repos/ada/demo";
const success: CommandResult = { exitCode: 0, stdout: "", stderr: "" };
const failure: CommandResult = { exitCode: 1, stdout: "", stderr: "failed" };

/** GitHub's state as `path → body`; a missing path answers 404. */
export type GithubState = Map<string, unknown>;

/** How to break the fixture; everything is healthy by default. */
export type FixtureOptions = {
  readonly isGitRepo?: boolean;
  readonly origin?: string;
  readonly isGhLoggedIn?: boolean;
  readonly hasHooks?: boolean;
  readonly hasReleaseWorkflow?: boolean;
  readonly keychain?: Readonly<Record<string, string>>;
  /** GitHub paths to remove (404) or replace. */
  readonly github?: Readonly<Record<string, unknown>>;
  /** Writes that fail, by `METHOD path`, with GitHub's message. */
  readonly failingWrites?: Readonly<Record<string, string>>;
};

/** A project folder, a fake `gh`/git/Keychain and a stateful fake GitHub, plus every call they received. */
export type DoctorFixture = {
  readonly dir: string;
  readonly run: RunCommand;
  readonly ghApi: GhApi;
  readonly state: GithubState;
  readonly commands: { readonly command: string; readonly input: string | undefined }[];
  readonly apiCalls: string[];
};

/** GitHub's ruleset answer includes fields blueprint doesn't set; doctor must accept them. */
const githubRuleset = {
  ...expectedRuleset,
  id: 1,
  rules: expectedRuleset.rules.map((rule) =>
    rule.type === "pull_request"
      ? {
          ...rule,
          parameters: {
            ...rule.parameters,
            require_extra_approval_for_unattributed_changes: true,
            required_reviewers: [],
          },
        }
      : rule,
  ),
};

const healthyState = (): GithubState =>
  new Map<string, unknown>([
    [repoPath, { ...expectedMergeSettings, private: true, default_branch: "main" }],
    [`${repoPath}/rulesets`, [{ id: 1, name: "blueprint-main" }]],
    [`${repoPath}/rulesets/1`, githubRuleset],
    [`${repoPath}/actions/permissions/workflow`, expectedWorkflowPermissions],
    [`${repoPath}/vulnerability-alerts`, undefined],
    [`${repoPath}/automated-security-fixes`, { enabled: true, paused: false }],
    [
      `${repoPath}/actions/secrets`,
      {
        secrets: [
          { name: "CLAUDE_CODE_OAUTH_TOKEN" },
          { name: "RELEASE_APP_CLIENT_ID" },
          { name: "RELEASE_APP_PRIVATE_KEY" },
        ],
      },
    ],
  ]);

const writeHooks = async (dir: string): Promise<void> => {
  await mkdir(join(dir, ".git", "hooks"), { recursive: true });
  for (const hook of ["pre-commit", "pre-push"]) {
    await writeFile(join(dir, ".git", "hooks", hook), "#!/bin/sh\nlefthook run\n");
  }
};

const answer = (
  state: GithubState,
  options: FixtureOptions,
  apiCalls: string[],
  path: string,
  request: { readonly method?: string; readonly body?: unknown },
): GhApiResult => {
  const method = request.method ?? "GET";
  apiCalls.push(`${method} ${path}`);
  const failingMessage = options.failingWrites?.[`${method} ${path}`];
  if (failingMessage !== undefined) {
    return { ok: false, status: 403, message: failingMessage };
  }
  if (method === "GET") {
    return state.has(path)
      ? { ok: true, body: state.get(path) }
      : { ok: false, status: 404, message: "Not Found" };
  }
  if (method === "POST" && path.endsWith("/rulesets")) {
    state.set(path, [{ id: 1, name: "blueprint-main" }]);
    state.set(`${path}/1`, { ...(request.body as object), id: 1 });
    return { ok: true, body: { id: 1 } };
  }
  const current = state.get(path);
  // A PUT without a body turns a feature on, like GitHub's security endpoints.
  const turnedOn = request.body ?? { enabled: true };
  state.set(
    path,
    method === "PATCH" ? { ...(current as object), ...(request.body as object) } : turnedOn,
  );
  return { ok: true, body: undefined };
};

const makeGhApi =
  (state: GithubState, options: FixtureOptions, apiCalls: string[]): GhApi =>
  (path, request = {}) =>
    Promise.resolve(answer(state, options, apiCalls, path, request));

const addSecret = (state: GithubState, name: string): void => {
  const path = `${repoPath}/actions/secrets`;
  const current = (state.get(path) as { readonly secrets: readonly { readonly name: string }[] })
    .secrets;
  state.set(path, { secrets: [...current.filter((secret) => secret.name !== name), { name }] });
};

/**
 * Builds a healthy blueprint project and GitHub repo, broken in the ways a test names.
 * @param options what to break
 */
export const makeDoctorFixture = async (options: FixtureOptions = {}): Promise<DoctorFixture> => {
  const dir = await mkdtemp(join(tmpdir(), "blueprint-doctor-"));
  if (options.hasHooks ?? true) {
    await writeHooks(dir);
  }
  if (options.hasReleaseWorkflow ?? false) {
    await mkdir(join(dir, ".github", "workflows"), { recursive: true });
    await writeFile(join(dir, ".github", "workflows", "release.yml"), "name: release\n");
  }
  const state = healthyState();
  for (const [path, body] of Object.entries(options.github ?? {})) {
    if (body === undefined) {
      state.delete(`${repoPath}${path}`);
    } else {
      state.set(`${repoPath}${path}`, body);
    }
  }
  const keychain = options.keychain ?? { "claude-oauth-token": "sk-test-token" };
  const commands: DoctorFixture["commands"] = [];
  const apiCalls: string[] = [];

  const run: RunCommand = async (command, args, runOptions = {}) => {
    const line = [command, ...args].join(" ");
    commands.push({ command: line, input: runOptions.input });
    if (line.startsWith("git rev-parse")) {
      return (options.isGitRepo ?? true) ? success : failure;
    }
    if (line.startsWith("git remote get-url")) {
      const origin = options.origin ?? "git@github.com:ada/demo.git";
      return origin === "" ? failure : { ...success, stdout: `${origin}\n` };
    }
    if (line === "gh auth status") {
      return (options.isGhLoggedIn ?? true) ? success : failure;
    }
    if (line.startsWith("security find-generic-password")) {
      const value = keychain[args[4] ?? ""];
      return value === undefined
        ? { ...failure, exitCode: 44 }
        : { ...success, stdout: `${value}\n` };
    }
    if (line.startsWith("gh secret set")) {
      addSecret(state, args[2] ?? "");
      return success;
    }
    if (line === "pnpm exec lefthook install") {
      await writeHooks(dir);
      return success;
    }
    return failure;
  };

  return { dir, run, ghApi: makeGhApi(state, options, apiCalls), state, commands, apiCalls };
};
