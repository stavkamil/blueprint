import { describe, expect, it } from "vitest";

import {
  type FixtureOptions,
  makeDoctorFixture,
} from "../modules/doctor/testing/make-doctor-fixture.ts";
import { runDoctorCommand } from "./doctor.ts";
import type { Io } from "./main.ts";

const runCommandLine = async (
  argv: readonly string[],
  options: FixtureOptions = {},
): Promise<{ readonly exitCode: number; readonly out: readonly string[] }> => {
  const fixture = await makeDoctorFixture(options);
  const out: string[] = [];
  const io: Io = {
    stdout: (line) => {
      out.push(line);
    },
    stderr: (line) => {
      out.push(line);
    },
  };
  const exitCode = await runDoctorCommand(argv, io, {
    run: fixture.run,
    cwd: fixture.dir,
    ghApi: fixture.ghApi,
  });
  return { exitCode, out };
};

describe("runDoctorCommand", () => {
  it("prints one line and exits 0 when everything passes", async () => {
    const { exitCode, out } = await runCommandLine([]);

    expect(exitCode).toBe(0);
    expect(out).toEqual(["blueprint doctor: all checks passed"]);
  });

  it("exits 1 and shows the fix when a problem remains", async () => {
    const { exitCode, out } = await runCommandLine([], { hasHooks: false });

    expect(exitCode).toBe(1);
    expect(out).toContain("✗ The git hooks aren't installed");
  });

  it("repairs with --fix and lists what it fixed", async () => {
    const { exitCode, out } = await runCommandLine(["--fix"], { hasHooks: false });

    expect(exitCode).toBe(0);
    expect(out).toEqual(["fixed: Git hooks", "blueprint doctor: all checks passed"]);
  });

  it("exits 2 when it can't run", async () => {
    const { exitCode, out } = await runCommandLine([], { isGitRepo: false });

    expect(exitCode).toBe(2);
    expect(out[0]).toContain("couldn't run");
  });

  it("prints one JSON result for --json", async () => {
    const { out } = await runCommandLine(["--json"]);

    expect(JSON.parse(out[0] ?? "")).toMatchObject({ ok: true, fixed: [] });
  });

  it("prints its options for --help", async () => {
    const { exitCode, out } = await runCommandLine(["--help"]);

    expect(exitCode).toBe(0);
    expect(out[0]).toMatch(/^Usage: blueprint doctor \[options\]\n/u);
  });
});
