import { HttpMethod } from "../../../lib/gh-api.ts";
import { isJsonSubset } from "../../../utils/is-json-subset.ts";
import { type Check, CheckStatus, Scope } from "../types.ts";
import { apiFailureFinding } from "./api-failure-finding.ts";

const alertsPath = "/vulnerability-alerts";
const fixesPath = "/automated-security-fixes";

/** `security.dependabot`: vulnerability alerts and Dependabot security updates are on. */
export const securityDependabotCheck: Check = {
  id: "security.dependabot",
  name: "Dependabot security updates",
  scope: Scope.Github,
  /**
   *
   */
  /** Reads both security settings. */
  run: async (context) => {
    // GitHub answers 204 when alerts are on and 404 when they're off.
    const alerts = await context.getRepo(alertsPath);
    const fixes = await context.getRepo(fixesPath);
    const isOn = alerts.ok && fixes.ok && isJsonSubset({ enabled: true }, fixes.body);
    return isOn
      ? { status: CheckStatus.Pass }
      : {
          status: CheckStatus.Fail,
          title: "Dependabot security alerts or updates are off",
          why: "Known vulnerabilities in dependencies would go unnoticed and unpatched.",
          action: "blueprint doctor --fix",
        };
  },
  /**
   *
   */
  /** Turns on alerts, then security updates. */
  fix: async (context) => {
    const base = `repos/${context.repo.owner}/${context.repo.name}`;
    for (const path of [alertsPath, fixesPath]) {
      const result = await context.ghApi(`${base}${path}`, { method: HttpMethod.Put });
      if (!result.ok) {
        return apiFailureFinding("turn on Dependabot security updates", result.message);
      }
    }
    return undefined;
  },
};
