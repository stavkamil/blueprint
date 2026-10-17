import { parseArgs } from "node:util";

import { BlueprintError } from "../utils/errors.ts";
import { readPackageVersion } from "../utils/version.ts";

/** Where the CLI writes its output; injected so tests can capture it. */
export type Io = {
  readonly stdout: (line: string) => void;
  readonly stderr: (line: string) => void;
};

const packageJsonUrl = new URL("../../package.json", import.meta.url);

const usage = [
  "Usage: blueprint [options]",
  "",
  "Options:",
  "  --version  Print the installed blueprint version",
  "  --help     Show this help",
].join("\n");

const helpHint = "Run `blueprint --help` to see what's available.";

const processIo: Io = {
  stdout: (line) => {
    process.stdout.write(`${line}\n`);
  },
  stderr: (line) => {
    process.stderr.write(`${line}\n`);
  },
};

/** Parses CLI arguments, runs the matching action and returns the exit code instead of exiting, so it stays testable. */
export const run = async (argv: readonly string[], io: Io = processIo): Promise<number> => {
  try {
    const { values, positionals } = parseArgs({
      args: [...argv],
      options: { version: { type: "boolean" }, help: { type: "boolean" } },
      allowPositionals: true,
      strict: true,
    });

    const [command] = positionals;
    if (command !== undefined) {
      throw new BlueprintError(`Unknown command '${command}'.`, helpHint);
    }
    if (values.version === true) {
      io.stdout(await readPackageVersion(packageJsonUrl));
      return 0;
    }
    io.stdout(usage);
    return 0;
  } catch (error) {
    if (error instanceof BlueprintError) {
      io.stderr(error.message);
      io.stderr(error.hint);
      return 1;
    }
    if (
      error instanceof TypeError &&
      "code" in error &&
      error.code === "ERR_PARSE_ARGS_UNKNOWN_OPTION"
    ) {
      const option = /'([^']+)'/u.exec(error.message)?.[1] ?? "option";
      io.stderr(`Unknown option '${option}'.`);
      io.stderr(helpHint);
      return 1;
    }
    throw error;
  }
};
