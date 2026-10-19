import { actionsPermissionsCheck } from "./checks/actions-permissions.ts";
import { hooksInstalledCheck } from "./checks/hooks-installed.ts";
import { repoMergeCheck } from "./checks/repo-merge.ts";
import { repoRulesetCheck } from "./checks/repo-ruleset.ts";
import { secretClaudeCheck } from "./checks/secret-claude.ts";
import { secretReleaseCheck } from "./checks/secret-release.ts";
import { securityDependabotCheck } from "./checks/security-dependabot.ts";
import type { Check } from "./types.ts";

/** Every check doctor runs, in report order. */
export const doctorChecks: readonly Check[] = [
  hooksInstalledCheck,
  repoMergeCheck,
  repoRulesetCheck,
  actionsPermissionsCheck,
  securityDependabotCheck,
  secretClaudeCheck,
  secretReleaseCheck,
];
