import { describe, expect, it } from "vitest";

import { runCommand } from "./run-command.ts";

describe("runCommand", () => {
  it("returns the output of a successful command", async () => {
    const result = await runCommand("node", ["-e", "process.stdout.write('hi')"]);

    expect(result).toEqual({ exitCode: 0, stdout: "hi", stderr: "" });
  });

  it("returns a failing command's exit code and stderr instead of throwing", async () => {
    const result = await runCommand("node", ["-e", "console.error('bad'); process.exit(3)"]);

    expect(result.exitCode).toBe(3);
    expect(result.stderr).toBe("bad\n");
  });

  it("sends input on stdin", async () => {
    const result = await runCommand("node", ["-e", "process.stdin.pipe(process.stdout)"], {
      input: "secret",
    });

    expect(result.stdout).toBe("secret");
  });

  it("reports a missing program as exit code 127", async () => {
    const result = await runCommand("blueprint-no-such-program", []);

    expect(result.exitCode).toBe(127);
    expect(result.stderr).toContain("ENOENT");
  });
});
