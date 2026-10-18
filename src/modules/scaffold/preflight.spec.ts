import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { makeFakeRunCommand } from "../../lib/testing/fake-run-command.ts";
import { type PreflightRequest, runPreflight } from "./preflight.ts";

const repoMissing = { exitCode: 1, stderr: "GraphQL: Could not resolve to a Repository" };

const healthy = {
  "pnpm --version": { stdout: "12.11.2\n" },
  "git config user.name": { stdout: "Ada\n" },
  "git config user.email": { stdout: "ada@example.com\n" },
  "gh repo view": repoMissing,
};

const makeRequest = async (
  overrides: Partial<PreflightRequest> = {},
): Promise<PreflightRequest> => ({
  projectName: "demo",
  parentDir: await mkdtemp(join(tmpdir(), "blueprint-preflight-")),
  github: true,
  nodeVersion: "24.1.0",
  ...overrides,
});

const messagesOf = (problems: readonly { readonly message: string }[]): string =>
  problems.map((problem) => problem.message).join("\n");

describe("runPreflight", () => {
  it("passes on a ready machine and returns the pnpm version", async () => {
    const { run } = makeFakeRunCommand(healthy);

    const result = await runPreflight(await makeRequest(), run);

    expect(result).toEqual({ problems: [], pnpmVersion: "12.11.2" });
  });

  it.each(["Demo", "my_app", "-demo", "a--b", "x".repeat(101)])(
    "refuses the invalid name %s without running anything",
    async (projectName) => {
      const { run, calls } = makeFakeRunCommand(healthy);

      const result = await runPreflight(await makeRequest({ projectName }), run);

      expect(messagesOf(result.problems)).toContain("isn't a valid project name");
      expect(calls).toEqual([]);
    },
  );

  it("refuses a folder that exists and isn't empty, but accepts an empty one", async () => {
    const request = await makeRequest();
    await mkdir(join(request.parentDir, "demo"));
    const { run } = makeFakeRunCommand(healthy);

    const empty = await runPreflight(request, run);
    await writeFile(join(request.parentDir, "demo", "notes.txt"), "keep me");
    const full = await runPreflight(request, run);

    expect(empty.problems).toEqual([]);
    expect(messagesOf(full.problems)).toContain("isn't empty");
  });

  it.each(["22.17.0", "20.11.1"])("refuses Node %s", async (nodeVersion) => {
    const { run } = makeFakeRunCommand(healthy);

    const result = await runPreflight(await makeRequest({ nodeVersion }), run);

    expect(messagesOf(result.problems)).toContain(`Node ${nodeVersion} is too old`);
  });

  it.each(["pnpm", "git", "gitleaks"])("refuses when %s is missing", async (tool) => {
    const { run } = makeFakeRunCommand({ ...healthy, [tool]: { exitCode: 127 } });

    const result = await runPreflight(await makeRequest(), run);

    expect(messagesOf(result.problems)).toContain(`\`${tool}\` isn't installed`);
  });

  it("refuses when git has no identity", async () => {
    const { run } = makeFakeRunCommand({ ...healthy, "git config user.email": { stdout: "" } });

    const result = await runPreflight(await makeRequest(), run);

    expect(messagesOf(result.problems)).toContain("no user name or email");
  });

  it("refuses when gh is logged out", async () => {
    const { run } = makeFakeRunCommand({ ...healthy, "gh auth status": { exitCode: 1 } });

    const result = await runPreflight(await makeRequest(), run);

    expect(messagesOf(result.problems)).toContain("isn't logged in");
  });

  it("refuses a repo name that's already taken", async () => {
    const { run } = makeFakeRunCommand({ ...healthy, "gh repo view": { exitCode: 0 } });

    const result = await runPreflight(await makeRequest(), run);

    expect(messagesOf(result.problems)).toContain("already have a GitHub repo named demo");
  });

  it("refuses when it can't tell whether the repo exists", async () => {
    const { run } = makeFakeRunCommand({
      ...healthy,
      "gh repo view": { exitCode: 1, stderr: "network down" },
    });

    const result = await runPreflight(await makeRequest(), run);

    expect(messagesOf(result.problems)).toContain("Couldn't check");
  });

  it("skips the GitHub checks with --no-github", async () => {
    const { run, calls } = makeFakeRunCommand({ ...healthy, "gh auth status": { exitCode: 1 } });

    const result = await runPreflight(await makeRequest({ github: false }), run);

    expect(result.problems).toEqual([]);
    expect(calls.some((call) => call.command.startsWith("gh"))).toBe(false);
  });
});
