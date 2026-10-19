import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { makeFakeRunCommand } from "../lib/testing/fake-run-command.ts";
import type { DoctorResult } from "../modules/doctor/types.ts";
import type { Problem } from "../modules/scaffold/types.ts";
import type { Io } from "./main.ts";
import { type NewEnvironment, runNew } from "./new.ts";

const ready = {
  "pnpm --version": { stdout: "12.11.2\n" },
  "git remote get-url": { exitCode: 2 },
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

const secured: DoctorResult = {
  ok: true,
  isLocalOnly: false,
  checks: [],
  fixed: ["Merge settings"],
};

const needsPro: DoctorResult = {
  ok: false,
  isLocalOnly: false,
  fixed: [],
  checks: [
    {
      id: "repo.ruleset",
      name: "Ruleset blueprint-main",
      status: "fail",
      title: "GitHub refused the ruleset",
      why: "Agents could push to main.",
      action: "Upgrade to GitHub Pro, then run blueprint doctor --fix",
    },
  ],
};

const makeEnvironment = async (
  responses: Parameters<typeof makeFakeRunCommand>[0] = ready,
  doctor: DoctorResult = secured,
): Promise<
  NewEnvironment & ReturnType<typeof makeFakeRunCommand> & { readonly securedDirs: string[] }
> => {
  const securedDirs: string[] = [];
  return {
    ...makeFakeRunCommand(responses),
    cwd: await mkdtemp(join(tmpdir(), "blueprint-new-")),
    nodeVersion: "24.1.0",
    securedDirs,
    secure: (dir) => {
      securedDirs.push(dir);
      return Promise.resolve(doctor);
    },
  };
};

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
    expect(out.slice(0, 7).every((line) => line.startsWith("✓ "))).toBe(true);
    expect(out[6]).toContain("Secured the repo");
    expect(environment.securedDirs).toEqual([join(environment.cwd, "demo")]);
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
    expect(result.steps).toContainEqual({ id: "secure", status: "done" });
    expect(result).toMatchObject({ resumable: false, manualSteps: [] });
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

  it("doesn't secure anything with --no-github", async () => {
    const { out, io } = makeIo();
    const environment = await makeEnvironment();

    await runNew(["demo", "--description", "A demo", "--no-github", "--json"], io, environment);

    const result = JSON.parse(out[0] ?? "") as { readonly steps: readonly unknown[] };
    expect(environment.securedDirs).toEqual([]);
    expect(result.steps).toContainEqual({ id: "secure", status: "skipped" });
  });

  it("lists the manual steps and the resume command when securing needs you", async () => {
    const { err, out, io } = makeIo();
    const environment = await makeEnvironment(ready, needsPro);

    const exitCode = await runNew(["demo", "--description", "A demo"], io, environment);
    await runNew(["other", "--description", "A demo", "--json"], io, environment);

    expect(exitCode).toBe(1);
    expect(err.join("\n")).toContain("GitHub refused the ruleset");
    expect(err.at(-1)).toBe("  → blueprint new demo --resume");
    expect(JSON.parse(out.at(-1) ?? "")).toMatchObject({
      ok: false,
      resumable: true,
      manualSteps: ["Upgrade to GitHub Pro, then run blueprint doctor --fix"],
      resumeCommand: "blueprint new other --resume",
    });
  });

  it("marks a failed repo creation as resumable, naming --dir when it isn't the current folder", async () => {
    const { err, io } = makeIo();
    const environment = await makeEnvironment({ ...ready, "gh repo create": { exitCode: 1 } });

    const exitCode = await runNew(
      ["demo", "--description", "A demo", "--dir", "my projects"],
      io,
      environment,
    );

    expect(exitCode).toBe(1);
    expect(err.at(-1)).toBe(
      `  → blueprint new demo --resume --dir '${join(environment.cwd, "my projects")}'`,
    );
  });

  it("resumes a committed project: pushes, then secures", async () => {
    const { io } = makeIo();
    const environment = await makeEnvironment({
      ...ready,
      "git remote get-url": { stdout: "https://github.com/ada/demo.git\n" },
    });
    await mkdir(join(environment.cwd, "demo"));
    await writeFile(
      join(environment.cwd, "demo", "package.json"),
      JSON.stringify({ name: "demo", description: "A demo" }),
    );

    const exitCode = await runNew(["demo", "--resume"], io, environment);

    expect(exitCode).toBe(0);
    expect(environment.calls.map((call) => call.command)).toContain(
      "git push --set-upstream origin main",
    );
    expect(environment.calls.some((call) => call.command.startsWith("pnpm install"))).toBe(false);
    expect(environment.securedDirs).toEqual([join(environment.cwd, "demo")]);
  });

  it("refuses to resume where there's no project", async () => {
    const { err, io } = makeIo();
    const environment = await makeEnvironment();

    const exitCode = await runNew(["demo", "--resume"], io, environment);

    expect(exitCode).toBe(2);
    expect(err[0]).toContain("Nothing to resume");
  });

  it("refuses to resume a folder with no commit", async () => {
    const { err, io } = makeIo();
    const environment = await makeEnvironment({ ...ready, "git rev-parse": { exitCode: 128 } });
    await mkdir(join(environment.cwd, "demo"));
    await writeFile(
      join(environment.cwd, "demo", "package.json"),
      JSON.stringify({ name: "demo" }),
    );

    const exitCode = await runNew(["demo", "--resume"], io, environment);

    expect(exitCode).toBe(2);
    expect(err[0]).toContain("no committed blueprint project");
  });
});
