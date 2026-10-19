import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { type Check, CheckStatus, Scope } from "../types.ts";

const hookNames = ["pre-commit", "pre-push"];

const isLefthookHook = async (dir: string, hook: string): Promise<boolean> => {
  const script = await readFile(join(dir, ".git", "hooks", hook), "utf8").catch(() => "");
  return script.includes("lefthook");
};

/** `hooks.installed`: lefthook's pre-commit and pre-push hooks are in place. */
export const hooksInstalledCheck: Check = {
  id: "hooks.installed",
  name: "Git hooks",
  scope: Scope.Local,
  /**
   *
   */
  /** Looks for lefthook's hooks in .git/hooks. */
  run: async ({ dir }) => {
    const installed = await Promise.all(hookNames.map((hook) => isLefthookHook(dir, hook)));
    return installed.every(Boolean)
      ? { status: CheckStatus.Pass }
      : {
          status: CheckStatus.Fail,
          title: "The git hooks aren't installed",
          why: "Commits skip formatting, lint and the secret scan, and pushes skip the tests.",
          action: "blueprint doctor --fix",
        };
  },
  /**
   *
   */
  /** Installs the hooks with lefthook. */
  fix: async ({ dir, run }) => {
    const result = await run("pnpm", ["exec", "lefthook", "install"], { cwd: dir });
    return result.exitCode === 0
      ? undefined
      : {
          title: "Installing the git hooks failed",
          why: result.stderr.trim(),
          action: "Run pnpm install, then pnpm exec lefthook install",
        };
  },
};
