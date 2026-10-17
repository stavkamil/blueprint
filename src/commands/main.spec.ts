import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { run } from "./main.ts";

// The version changes with every release, so the test reads it instead of hard-coding it.
const readExpectedVersion = async (): Promise<string> => {
  const pkg: unknown = JSON.parse(
    await readFile(new URL("../../package.json", import.meta.url), "utf8"),
  );
  if (typeof pkg !== "object" || pkg === null || !("version" in pkg)) {
    throw new Error("package.json has no version");
  }
  return String(pkg.version);
};

const makeIo = (): {
  readonly out: string[];
  readonly err: string[];
  readonly io: Parameters<typeof run>[1];
} => {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    io: {
      stdout: (line: string) => {
        out.push(line);
      },
      stderr: (line: string) => {
        err.push(line);
      },
    },
  };
};

describe("run", () => {
  it("prints the package version for --version", async () => {
    const { out, io } = makeIo();

    const exitCode = await run(["--version"], io);

    expect(exitCode).toBe(0);
    expect(out).toEqual([await readExpectedVersion()]);
  });

  it("prints usage for --help", async () => {
    const { out, io } = makeIo();

    const exitCode = await run(["--help"], io);

    expect(exitCode).toBe(0);
    expect(out.join("\n")).toContain("Usage: blueprint");
  });

  it("prints usage when called with no arguments", async () => {
    const { out, io } = makeIo();

    const exitCode = await run([], io);

    expect(exitCode).toBe(0);
    expect(out.join("\n")).toContain("Usage: blueprint");
  });

  it("rejects an unknown flag and points to --help", async () => {
    const { err, io } = makeIo();

    const exitCode = await run(["--nope"], io);

    expect(exitCode).toBe(1);
    expect(err).toEqual([
      "Unknown option '--nope'.",
      "Run `blueprint --help` to see what's available.",
    ]);
  });

  it("rejects an unknown command and points to --help", async () => {
    const { err, io } = makeIo();

    const exitCode = await run(["launch"], io);

    expect(exitCode).toBe(1);
    expect(err.join("\n")).toContain("launch");
    expect(err.join("\n")).toContain("blueprint --help");
  });
});
