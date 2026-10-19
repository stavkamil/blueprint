import { HttpMethod } from "../../../lib/gh-api.ts";
import { isJsonSubset } from "../../../utils/is-json-subset.ts";
import { expectedMergeSettings } from "../constants.ts";
import { type Check, CheckStatus, Scope } from "../types.ts";
import { apiFailureFinding } from "./api-failure-finding.ts";

/** `repo.merge`: squash merges only, titled by the PR, branches deleted on merge. */
export const repoMergeCheck: Check = {
  id: "repo.merge",
  name: "Merge settings",
  scope: Scope.Github,
  /**
   *
   */
  /** Compares the repo merge settings. */
  run: async (context) => {
    const repo = await context.getRepo();
    if (!repo.ok) {
      return {
        status: CheckStatus.Fail,
        ...apiFailureFinding("read the repo settings", repo.message),
      };
    }
    return isJsonSubset(expectedMergeSettings, repo.body)
      ? { status: CheckStatus.Pass }
      : {
          status: CheckStatus.Fail,
          title: "Merge settings allow more than squash merges",
          why: "Merge commits and rebases make main's history harder to read and revert.",
          action: "blueprint doctor --fix",
        };
  },
  /**
   *
   */
  /** Switches the repo to squash-only merges. */
  fix: async (context) => {
    const path = `repos/${context.repo.owner}/${context.repo.name}`;
    const result = await context.ghApi(path, {
      method: HttpMethod.Patch,
      body: expectedMergeSettings,
    });
    return result.ok ? undefined : apiFailureFinding("update the merge settings", result.message);
  },
};
