import type { Finding } from "../types.ts";

/**
 * Explains a GitHub call that failed for a reason doctor can't fix, so the run still finishes with a clear next step.
 * @param what what doctor was doing, e.g. "read the merge settings"
 * @param message GitHub's error message
 */
export const apiFailureFinding = (what: string, message: string): Finding => ({
  title: `Couldn't ${what}: ${message}`,
  why: "doctor can't confirm this part of the setup.",
  action: "Check `gh auth status` and your network, then run blueprint doctor again.",
});
