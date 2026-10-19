import type { RunCommand } from "./run-command.ts";

/** The Keychain service every blueprint item is saved under. */
const keychainService = "blueprint";

/**
 * Reads one secret from the macOS Keychain (service `blueprint`). Returns undefined when the item is missing, so
 * callers can print the command that saves it. The value is never logged.
 * @param run runs `security`; tests pass a fake
 * @param account the item's account name, e.g. `claude-oauth-token`
 */
export const readKeychainSecret = async (
  run: RunCommand,
  account: string,
): Promise<string | undefined> => {
  const result = await run("security", [
    "find-generic-password",
    "-s",
    keychainService,
    "-a",
    account,
    "-w",
  ]);
  const value = result.stdout.trim();
  return result.exitCode === 0 && value !== "" ? value : undefined;
};
