import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { makeFakeRunCommand } from "../lib/testing/fake-run-command.ts";
import type { Problem } from "../modules/scaffold/types.ts";
import type { Io } from "./main.ts";
import { runNew } from "./new.ts";

const ready = {
  "pnpm --version": { stdout: "12.11.2\n" },
  "git config user.name": { stdout: "Ada\n" },
  "git config user.email": { stdout: "ada@example.com\n" },
  "gh repo view": { exitCode: 1, stderr: "Could not resolve to a Repository" },
  "gh repo create": { stdout: "https://github.com/ada/demo\n" },
};

const makeIo = (): { readonly out: string[]; readonly err: string[]; readonly io: Io } => {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    io: {
      stdout: (line) => {
        out.push(line);
      },
      stderr: (line) => {
        err.push(line);
      },
    },
  };
};

const makeEnvironment = async (
  responses: Parameters<typeof makeFakeRunCommand>[0] = ready,
): Promise<Parameters<typeof runNew>[2] & ReturnType<typeof makeFakeRunCommand>> => ({
  ...makeFakeRunCommand(responses),
  cwd: await mkdtemp(join(tmpdir(), "blueprint-new-")),
  nodeVersion: "24.1.0",
});

describe("runNew", () => {
  it("prints its options for --help", async () => {
    const { out, io } = makeIo();

    const exitCode = await runNew(["--help"], io, await makeEnvironment());

    expect(exitCode).toBe(0);
    expect(out.join("\n")).toContain("Usage: blueprint new <name>");
  });

  it.each([
    [["--description", "x"], "Give exactly one project name."],
    [["demo", "extra", "--description", "x"], "Give exactly one project name."],
    [["demo"], "--description is required."],
    [["demo", "--description", "  "], "--description is required."],
    [
      ["demo", "--description", "x", "--type", "rails"],
      "Unknown --type 'rails'. Use ts or nextjs.",
    ],
  ])("refuses %j", async (argv, message) => {
    const { io } = makeIo();

    const attempt = runNew(argv, io, await makeEnvironment());

    await expect(attempt).rejects.toMatchObject({ name: "BlueprintError", message });
  });

  it("creates the project and prints one line per step plus a summary", async () => {
    const { out, io } = makeIo();
    const environment = await makeEnvironment();

    const exitCode = await runNew(["demo", "--description", "A demo"], io, environment);

    expect(exitCode).toBe(0);
    expect(out.slice(0, 6).every((line) => line.startsWith("✓ "))).toBe(true);
    expect(out).toContain("Repo: https://github.com/ada/demo");
    expect(out).toContain(`Next: cd ${join(environment.cwd, "demo")} && claude`);
  });

  it("records the running pnpm and blueprint's own versions in the project", async () => {
    const { io } = makeIo();
    const environment = await makeEnvironment();

    await runNew(["demo", "--description", "A demo", "--no-github"], io, environment);

    const commit = environment.calls.find((call) => call.command.startsWith("git commit"));
    expect(commit?.command).toMatch(/initial commit from blueprint v\d+\.\d+\.\d+/u);
  });

  it("prints every preflight problem and exits 2 without creating anything", async () => {
    const { err, io } = makeIo();
    const environment = await makeEnvironment({
      ...ready,
      gitleaks: { exitCode: 127 },
      "gh auth": { exitCode: 1 },
    });

    const exitCode = await runNew(["demo", "--description", "A demo"], io, environment);

    expect(exitCode).toBe(2);
    expect(err.join("\n")).toContain("`gitleaks` isn't installed");
    expect(err.join("\n")).toContain("isn't logged in");
    expect(environment.calls.some((call) => call.command.startsWith("git init"))).toBe(false);
  });

  it("prints one JSON result for --json", async () => {
    const { out, io } = makeIo();
    const environment = await makeEnvironment();

    const exitCode = await runNew(
      ["demo", "--description", "A demo", "--type", "ts", "--dir", "projects", "--json"],
      io,
      environment,
    );

    expect(exitCode).toBe(0);
    expect(out).toHaveLength(1);
    const result = JSON.parse(out[0] ?? "") as Record<string, unknown>;
    expect(result).toMatchObject({
      ok: true,
      project: {
        name: "demo",
        dir: join(environment.cwd, "projects", "demo"),
        type: "ts",
        url: "https://github.com/ada/demo",
      },
      problems: [],
    });
    expect(result.steps).toContainEqual({ id: "create-repo", status: "done" });
  });

  it("prints refusals as JSON too", async () => {
    const { out, io } = makeIo();
    const environment = await makeEnvironment({ ...ready, "gh repo view": { exitCode: 0 } });

    const exitCode = await runNew(["demo", "--description", "A demo", "--json"], io, environment);

    expect(exitCode).toBe(2);
    const result = JSON.parse(out[0] ?? "") as { readonly problems: readonly Problem[] };
    expect(result).toMatchObject({ ok: false, steps: [] });
    expect(result.problems[0]?.message).toContain("already have a GitHub repo");
  });

  it("exits 1 with the failing output when a step fails", async () => {
    const { err, io } = makeIo();
    const environment = await makeEnvironment({
      ...ready,
      "pnpm lint": { exitCode: 1, stdout: "src/x.ts:1 error" },
    });

    const exitCode = await runNew(["demo", "--description", "A demo"], io, environment);

    expect(exitCode).toBe(1);
    expect(err[0]).toContain("`pnpm lint` failed on the fresh project");
    expect(err).toContain("src/x.ts:1 error");
  });
});
