/** The ruleset doctor manages, found by name so it never touches rulesets you add yourself. */
export const rulesetName = "blueprint-main";

/** GitHub Actions' app id; pins the required check to Actions so nothing else can report it. */
const githubActionsAppId = 15368;

/** The ruleset on the default branch: PRs only, squash only, conversations resolved, CI green and up to date. */
export const expectedRuleset = {
  name: rulesetName,
  target: "branch",
  enforcement: "active",
  conditions: { ref_name: { include: ["~DEFAULT_BRANCH"], exclude: [] } },
  bypass_actors: [],
  rules: [
    { type: "deletion" },
    { type: "non_fast_forward" },
    {
      type: "pull_request",
      parameters: {
        // You can't approve your own PRs, so a required approval would block every merge.
        required_approving_review_count: 0,
        dismiss_stale_reviews_on_push: true,
        require_code_owner_review: false,
        require_last_push_approval: false,
        required_review_thread_resolution: true,
        allowed_merge_methods: ["squash"],
      },
    },
    {
      type: "required_status_checks",
      parameters: {
        strict_required_status_checks_policy: true,
        do_not_enforce_on_create: false,
        required_status_checks: [{ context: "ci / ci-ok", integration_id: githubActionsAppId }],
      },
    },
  ],
} as const;

/** Squash merges only, titled and described by the PR, with the branch deleted afterwards. */
export const expectedMergeSettings = {
  allow_squash_merge: true,
  allow_merge_commit: false,
  allow_rebase_merge: false,
  squash_merge_commit_title: "PR_TITLE",
  squash_merge_commit_message: "PR_BODY",
  delete_branch_on_merge: true,
} as const;

/** The default workflow token is read-only and can't approve PRs. */
export const expectedWorkflowPermissions = {
  default_workflow_permissions: "read",
  can_approve_pull_request_reviews: false,
} as const;

/** Repo secrets and the Keychain items (service `blueprint`) they're copied from. */
export const Secret = {
  Claude: { name: "CLAUDE_CODE_OAUTH_TOKEN", account: "claude-oauth-token", isBase64: false },
  ReleaseClientId: {
    name: "RELEASE_APP_CLIENT_ID",
    account: "release-app-client-id",
    isBase64: false,
  },
  ReleaseKey: { name: "RELEASE_APP_PRIVATE_KEY", account: "release-app-key", isBase64: true },
} as const;
