import { access } from "node:fs/promises";
import { join } from "node:path";

import { Secret } from "../constants.ts";
import { type Check, CheckStatus, Scope } from "../types.ts";
import { apiFailureFinding } from "./api-failure-finding.ts";
import { readSecretNames } from "./read-secret-names.ts";
import { setSecretFromKeychain } from "./set-secret-from-keychain.ts";

const releaseSecrets = [Secret.ReleaseClientId, Secret.ReleaseKey];

const hasReleaseWorkflow = async (dir: string): Promise<boolean> => {
  try {
    await access(join(dir, ".github", "workflows", "release.yml"));
    return true;
  } catch {
    return false;
  }
};

/** `secret.release`: with releases on, the release app's client id and key are set on the repo. */
export const secretReleaseCheck: Check = {
  id: "secret.release",
  name: "Release app secrets",
  scope: Scope.Github,
  /**
   *
   */
  /** Looks for both secrets when the project has a release workflow. */
  run: async (context) => {
    if (!(await hasReleaseWorkflow(context.dir))) {
      return { status: CheckStatus.Skipped };
    }
    const names = await readSecretNames(context);
    if (typeof names === "string") {
      return { status: CheckStatus.Fail, ...apiFailureFinding("list the repo secrets", names) };
    }
    const missing = releaseSecrets.filter((secret) => !names.has(secret.name));
    return missing.length === 0
      ? { status: CheckStatus.Pass }
      : {
          status: CheckStatus.Fail,
          title: `Release secrets are missing: ${missing.map((secret) => secret.name).join(", ")}`,
          why: "release-please can't open release PRs that run CI without the release app.",
          action: "blueprint doctor --fix",
        };
  },
  /**
   *
   */
  /** Copies both secrets from the Keychain. */
  fix: async (context) => {
    for (const secret of releaseSecrets) {
      const finding = await setSecretFromKeychain(context, secret);
      if (finding !== undefined) {
        return finding;
      }
    }
    return undefined;
  },
};
