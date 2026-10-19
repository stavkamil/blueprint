import { parseArgs } from "node:util";

import type { GhApi } from "../lib/gh-api.ts";
import { type RunCommand, runCommand } from "../lib/run-command.ts";
import { formatDoctorReport } from "../modules/doctor/format-doctor-report.ts";
import { runDoctor } from "../modules/doctor/run-doctor.ts";
import type { Io } from "./main.ts";

/** What `blueprint doctor` reads from its surroundings; tests replace it. */
export type DoctorEnvironment = {
  readonly run: RunCommand;
  readonly cwd: string;
  readonly ghApi?: GhApi;
};

const exitProblems = 1;
const exitBlocked = 2;

const usage = [
  "Usage: blueprint doctor [options]",
  "",
  "Checks this project's git hooks and its GitHub setup (merge settings, ruleset, Actions permissions,",
  "Dependabot, secrets), and prints the exact fix for each problem.",
  "",
  "Options:",
  "  --fix   Repair what's fixable (secrets come from the macOS Keychain), then check again",
  "  --json  Print one JSON result",
].join("\n");

/**
 * `blueprint doctor`: exit 0 when everything passes, 1 when a problem remains, 2 when doctor couldn't run.
 * @param argv the arguments after `doctor`
 * @param io where output goes
 * @param environment the command runner and current folder
 */
export const runDoctorCommand = async (
  argv: readonly string[],
  io: Io,
  environment: DoctorEnvironment = { run: runCommand, cwd: process.cwd() },
): Promise<number> => {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      fix: { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
    strict: true,
  });
  if (values.help) {
    io.stdout(usage);
    return 0;
  }
  const result = await runDoctor({
    dir: environment.cwd,
    fix: values.fix,
    run: environment.run,
    ghApi: environment.ghApi,
  });
  if (values.json) {
    io.stdout(JSON.stringify(result));
  } else {
    formatDoctorReport(result).forEach((line) => {
      io.stdout(line);
    });
  }
  if (result.blocked !== undefined) {
    return exitBlocked;
  }
  return result.ok ? 0 : exitProblems;
};
