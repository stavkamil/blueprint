import type { CommandResult, RunCommand } from "../run-command.ts";

/** One call the fake received. */
export type RecordedCall = { readonly command: string; readonly cwd: string | undefined };

/** A {@link RunCommand} fake plus the calls it received, as `"program arg arg"` strings. */
export type FakeRunCommand = { readonly run: RunCommand; readonly calls: RecordedCall[] };

const success: CommandResult = { exitCode: 0, stdout: "", stderr: "" };

/**
 * Builds a fake command runner: every command succeeds with empty output unless a response matches its start.
 * When several prefixes match, the last one listed wins, so `{ ...defaults, git: failure }` overrides the defaults.
 * @param responses results by command prefix, e.g. `{ "gh auth status": { exitCode: 1, ... } }`
 */
export const makeFakeRunCommand = (
  responses: Readonly<Record<string, Partial<CommandResult>>> = {},
): FakeRunCommand => {
  const calls: RecordedCall[] = [];
  const run: RunCommand = (command, args, options = {}) => {
    const line = [command, ...args].join(" ");
    calls.push({ command: line, cwd: options.cwd });
    const match = Object.entries(responses).findLast(([prefix]) => line.startsWith(prefix));
    return Promise.resolve({ ...success, ...match?.[1] });
  };
  return { run, calls };
};
