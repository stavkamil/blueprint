import { access, stat } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { makeFakeRunCommand } from "../../lib/testing/fake-run-command.ts";
import { runScaffold } from "./run-scaffold.ts";
import { makeScaffoldOptions } from "./testing/make-scaffold-options.ts";
import { Visibility } from "./types.ts";

const repoUrl = "https://github.com/ada/demo";
const repoCreated = { "gh repo create": { stdout: `${repoUrl}\n` } };

describe("runScaffold", () => {
  it("runs every step in order and returns the repo URL", async () => {
    const options = await makeScaffoldOptions();
    const { run, calls } = makeFakeRunCommand(repoCreated);
    const titles: string[] = [];

    const result = await runScaffold(options, run, (title) => {
      titles.push(title);
    });

    expect(calls.map((call) => call.command)).toEqual([
      "git init --initial-branch=main",
      "pnpm install --no-frozen-lockfile",
      "pnpm lint",
      "pnpm typecheck",
      "pnpm test",
      "pnpm build",
      "git add --all",
      "git commit --message chore: initial commit from blueprint v1.2.3",
      "gh repo create demo --private --description A demo project --source . --push",
    ]);
    expect(calls.every((call) => call.cwd === result.dir)).toBe(true);
    expect(result).toMatchObject({ ok: true, url: repoUrl, dir: join(options.parentDir, "demo") });
    expect(result.steps.every((step) => step.status === "done")).toBe(true);
    expect(titles).toHaveLength(6);
    expect(titles[0]).toBe("Scaffolded (ts)");
  });

  it("writes the rendered project, with executable hook scripts", async () => {
    const options = await makeScaffoldOptions({ github: false });
    const { run } = makeFakeRunCommand();

    const result = await runScaffold(options, run);

    await access(join(result.dir, "AGENTS.md"));
    const hook = await stat(join(result.dir, ".claude/hooks/session-start.sh"));
    expect(hook.mode & 0o111).not.toBe(0);
  });

  it("stops before GitHub when verify fails, and keeps the folder", async () => {
    const options = await makeScaffoldOptions();
    const { run, calls } = makeFakeRunCommand({
      "pnpm test": { exitCode: 1, stdout: "coverage 12% < 80%" },
    });

    const result = await runScaffold(options, run);

    expect(result.ok).toBe(false);
    expect(result.problem?.message).toContain("`pnpm test` failed on the fresh project");
    expect(result.problem?.hint).toContain(`The folder ${result.dir} is kept`);
    expect(result.problem?.output).toBe("coverage 12% < 80%");
    expect(calls.some((call) => call.command.startsWith("gh"))).toBe(false);
    expect(result.steps).toEqual([
      { id: "scaffold", status: "done" },
      { id: "init-git", status: "done" },
      { id: "install", status: "done" },
      { id: "verify", status: "failed" },
      { id: "commit", status: "pending" },
      { id: "create-repo", status: "pending" },
    ]);
    await access(join(result.dir, "package.json"));
  });

  it("stops after the local commit with --no-github", async () => {
    const options = await makeScaffoldOptions({ github: false });
    const { run, calls } = makeFakeRunCommand();

    const result = await runScaffold(options, run);

    expect(result.ok).toBe(true);
    expect(result.url).toBeUndefined();
    expect(result.steps.at(-1)).toEqual({ id: "create-repo", status: "skipped" });
    expect(calls.some((call) => call.command.startsWith("gh"))).toBe(false);
  });

  it("creates a public repo when asked", async () => {
    const options = await makeScaffoldOptions({ visibility: Visibility.Public });
    const { run, calls } = makeFakeRunCommand(repoCreated);

    await runScaffold(options, run);

    expect(calls.at(-1)?.command).toContain("--public");
  });

  it("explains how to finish by hand when creating the repo fails", async () => {
    const options = await makeScaffoldOptions();
    const { run } = makeFakeRunCommand({
      "gh repo create": { exitCode: 1, stderr: "HTTP 403" },
    });

    const result = await runScaffold(options, run);

    expect(result.ok).toBe(false);
    expect(result.steps.at(-1)).toEqual({ id: "create-repo", status: "failed" });
    expect(result.problem?.hint).toContain(
      "gh repo create demo --private --description 'A demo project' --source . --push",
    );
    expect(result.problem?.output).toBe("HTTP 403");
  });

  it("quotes an apostrophe in the description so the printed command still works", async () => {
    const options = await makeScaffoldOptions();
    const template = { ...options.template, description: "Ada's app" };
    const { run } = makeFakeRunCommand({ "gh repo create": { exitCode: 1 } });

    const result = await runScaffold({ ...options, template }, run);

    expect(result.problem?.hint).toContain(String.raw`--description 'Ada'\''s app'`);
  });

  it.each([
    ["git init", "`git init` failed."],
    ["pnpm install", "`pnpm install` failed."],
    ["git add", "`git add` failed."],
    ["git commit", "`git commit` failed."],
  ])("reports a failing %s as not resumable", async (command, message) => {
    const options = await makeScaffoldOptions();
    const { run } = makeFakeRunCommand({ [command]: { exitCode: 1, stderr: "boom" } });

    const result = await runScaffold(options, run);

    expect(result.problem?.message).toBe(message);
    expect(result.problem?.hint).toContain("Not resumable.");
  });
});
