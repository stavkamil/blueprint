import { HttpMethod } from "../../../lib/gh-api.ts";
import { isJsonSubset } from "../../../utils/is-json-subset.ts";
import { expectedWorkflowPermissions } from "../constants.ts";
import { type Check, CheckStatus, Scope } from "../types.ts";
import { apiFailureFinding } from "./api-failure-finding.ts";

const permissionsPath = "/actions/permissions/workflow";

/** `actions.permissions`: the default workflow token is read-only and can't approve pull requests. */
export const actionsPermissionsCheck: Check = {
  id: "actions.permissions",
  name: "Workflow token permissions",
  scope: Scope.Github,
  /**
   *
   */
  /** Reads the workflow token settings. */
  run: async (context) => {
    const permissions = await context.getRepo(permissionsPath);
    if (!permissions.ok) {
      return {
        status: CheckStatus.Fail,
        ...apiFailureFinding("read the Actions permissions", permissions.message),
      };
    }
    return isJsonSubset(expectedWorkflowPermissions, permissions.body)
      ? { status: CheckStatus.Pass }
      : {
          status: CheckStatus.Fail,
          title: "Workflows get a write token or can approve pull requests",
          why: "A compromised workflow could change the repo or approve its own changes.",
          action: "blueprint doctor --fix",
        };
  },
  /**
   *
   */
  /** Makes the token read-only and stops it approving PRs. */
  fix: async (context) => {
    const path = `repos/${context.repo.owner}/${context.repo.name}${permissionsPath}`;
    const result = await context.ghApi(path, {
      method: HttpMethod.Put,
      body: expectedWorkflowPermissions,
    });
    return result.ok
      ? undefined
      : apiFailureFinding("update the Actions permissions", result.message);
  },
};
