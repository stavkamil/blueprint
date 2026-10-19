import { Secret } from "../constants.ts";
import { type Check, CheckStatus, Scope } from "../types.ts";
import { apiFailureFinding } from "./api-failure-finding.ts";
import { readSecretNames } from "./read-secret-names.ts";
import { setSecretFromKeychain } from "./set-secret-from-keychain.ts";

/** `secret.claude`: the token the AI review runs with is set on the repo. */
export const secretClaudeCheck: Check = {
  id: "secret.claude",
  name: "CLAUDE_CODE_OAUTH_TOKEN secret",
  scope: Scope.Github,
  /**
   *
   */
  /** Looks for the secret by name; the value is never read. */
  run: async (context) => {
    const names = await readSecretNames(context);
    if (typeof names === "string") {
      return { status: CheckStatus.Fail, ...apiFailureFinding("list the repo secrets", names) };
    }
    return names.has(Secret.Claude.name)
      ? { status: CheckStatus.Pass }
      : {
          status: CheckStatus.Fail,
          title: `The ${Secret.Claude.name} secret is missing`,
          why: "The AI review can't run without it.",
          action: "blueprint doctor --fix",
        };
  },
  /**
   *
   */
  /** Copies the token from the Keychain. */
  fix: (context) => setSecretFromKeychain(context, Secret.Claude),
};
