import type { Finding } from "../types.ts";

const upgradeMessage = /upgrade|github pro|make this repository public/iu;

/** What doctor says when GitHub refuses the ruleset because a private repo needs GitHub Pro. */
export const noProFinding: Finding = {
  title: "GitHub refused the ruleset: private repos need GitHub Pro for rulesets",
  why: "Without the ruleset, agents could push straight to main and merge without green CI.",
  action:
    "Upgrade to GitHub Pro (https://github.com/settings/billing) or make the repo public, then run blueprint doctor --fix",
};

/**
 * True when GitHub's error asks for an upgrade, which is how doctor detects a missing GitHub Pro plan without
 * needing permission to read your plan.
 * @param message GitHub's error message
 */
export const isUpgradeRequired = (message: string): boolean => upgradeMessage.test(message);
