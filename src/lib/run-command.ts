import { execFile } from "node:child_process";

import { maxCommandOutputBytes } from "./constants.ts";

/** What a finished command returned. A non-zero exit code is a result, not an exception. */
export type CommandResult = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

/** Where a command runs, and what it reads on stdin. */
export type RunOptions = {
  readonly cwd?: string;
  /** Sent on stdin; how secrets reach `gh secret set`, so they never appear in arguments. */
  readonly input?: string;
};

/** Runs one external command with arguments as an array (no shell), so names and descriptions can't inject flags. */
export type RunCommand = (
  command: string,
  args: readonly string[],
  options?: RunOptions,
) => Promise<CommandResult>;

/** Exit code shells use for "command not found". */
const notFoundExitCode = 127;

/**
 * The real {@link RunCommand}, backed by `execFile`. Tests pass a fake instead.
 * @param command the program to run
 * @param args its arguments
 * @param options the working directory and stdin
 */
export const runCommand: RunCommand = (command, args, options = {}) =>
  new Promise((resolve) => {
    const child = execFile(
      command,
      [...args],
      { cwd: options.cwd, maxBuffer: maxCommandOutputBytes, encoding: "utf8" },
      (error, stdout, stderr) => {
        if (error === null) {
          resolve({ exitCode: 0, stdout, stderr });
          return;
        }
        const exitCode = typeof error.code === "number" ? error.code : notFoundExitCode;
        resolve({ exitCode, stdout, stderr: stderr === "" ? error.message : stderr });
      },
    );
    child.stdin?.end(options.input ?? "");
  });
