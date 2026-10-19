import { readKeychainSecret } from "../../../lib/keychain.ts";
import type { Finding, GithubContext } from "../types.ts";

/** A repo secret and the Keychain item it's copied from. */
export type SecretSource = {
  readonly name: string;
  readonly account: string;
  /** The Keychain holds the value base64-encoded (multi-line keys). */
  readonly isBase64: boolean;
};

/**
 * Copies a secret from the macOS Keychain into the repo through stdin, so the value never appears in arguments or
 * output. Returns a finding with the exact save command when the Keychain item is missing.
 * @param context the GitHub context
 * @param source which secret, and where it lives in the Keychain
 */
export const setSecretFromKeychain = async (
  context: GithubContext,
  source: SecretSource,
): Promise<Finding | undefined> => {
  const stored = await readKeychainSecret(context.run, source.account);
  if (stored === undefined) {
    // A bare -w at the end makes `security` prompt for the value, so it stays out of shell history.
    const value = source.isBase64 ? ' "$(base64 < <key-file>.pem)"' : "";
    return {
      title: `The Keychain has no '${source.account}' item (service blueprint)`,
      why: `doctor copies it into the repo's ${source.name} secret.`,
      action: `security add-generic-password -s blueprint -a ${source.account} -j "created:$(date +%F)" -w${value}, then blueprint doctor --fix`,
    };
  }
  const value = source.isBase64 ? Buffer.from(stored, "base64").toString("utf8") : stored;
  const repo = `${context.repo.owner}/${context.repo.name}`;
  const result = await context.run("gh", ["secret", "set", source.name, "--repo", repo], {
    input: value,
  });
  return result.exitCode === 0
    ? undefined
    : {
        title: `Setting the ${source.name} secret failed`,
        why: result.stderr.trim(),
        action: "Check `gh auth status`, then run blueprint doctor --fix",
      };
};
