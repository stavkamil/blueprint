# Spec: ci-workflows

Module 4 of 8 in [CAPABILITY-MAP.md](CAPABILITY-MAP.md). Depends on `repo-foundation`. `project-template` depends on it.

## Objective

Provide the CI that every blueprint project runs, defined once in the blueprint repo and referenced by each project
through a short caller workflow pinned to blueprint's major version (`@v1` for all of 1.x). A fix to CI reaches every
project immediately, and project PRs can't change the CI logic because it doesn't live in the project.

**Users:** blueprint projects (callers), blueprint itself (it runs the same workflows on its own PRs), and you,
reading results on GitHub Mobile.

**Scope:**
- three reusable workflows (`reusable-checks`, `reusable-ai-review`, `reusable-release`)
- the composite actions they share
- the interface callers use
- the security posture of all of them

**Out of scope:**
- writing the caller files into projects (`project-template`)
- the rulesets and the required-check setting (`cli-doctor`)
- blueprint's own `ci.yml` and `release.yml` (`repo-foundation`)
- deploys and npm publishing for projects (v2)

### Acceptance criteria

1. **Single required check.** In a project, a PR shows one required check named `ci / ci-ok`. It passes only when lint, typecheck, tests (with the 80% coverage threshold), build, the PR-title check and the gitleaks scan all pass.
2. **Clear failures.** Each failing step prints one line saying what failed and the command that reproduces it locally (e.g. "Lint failed: run `pnpm lint`").
3. **PR-title check.** A non-Conventional-Commit title fails with the expected format. Editing the title re-runs the check without a new push.
4. **AI review once.** AI review runs when a PR is opened or marked ready, posts inline comments for important findings only (or one "no issues" summary comment), and never runs on drafts.
5. **AI review on request.** Commenting `@claude review` on a PR, as a user with write access, re-runs the same review. Other comments neither start nor cancel a review.
6. **Never blocks a merge.** AI review is skipped for Dependabot PRs, isn't part of `ci-ok`, and a review error never blocks merging.
7. **Release (opt-in).** On push to `main`, release-please opens or updates a release PR using the release app's token, and `ci / ci-ok` runs on that PR. Merging it creates a tag, a GitHub release and a changelog entry.
8. **Least privilege, hardened.**
   - Every workflow starts with `permissions: {}` and grants each job only what it needs.
   - Third-party actions are pinned by commit SHA.
   - Checkouts use `persist-credentials: false`.
   - actionlint and zizmor report zero findings.
9. **Dependabot works.** Dependabot PRs run `reusable-checks` successfully without access to any secret.
10. **Dogfooding.** Blueprint's own PRs run `reusable-checks` and `reusable-ai-review` from local paths, so every change to them is exercised before release.
11. **Live check.** A throwaway private repo with the documented caller files passes criteria 1–7 once, verified manually before v1.

## Workflows and their interface

All live in `stavkamil/blueprint/.github/workflows/` and are triggered only by `workflow_call`. The `reusable-` prefix
keeps them apart from blueprint's own `ci.yml`, `ai-review.yml` and `release.yml`.

| Workflow | What it runs | Inputs | Secrets (passed **explicitly**, never `inherit`) | Job permissions |
|---|---|---|---|---|
| `reusable-checks.yml` | Jobs: `quality` (`pnpm lint`, `pnpm typecheck`, `pnpm test` with coverage, `pnpm build`), `pr-title` (PR events only), `gitleaks` (the PR's commit range), `doctor` (non-blocking), and the aggregate `ci-ok` | `working-directory` (default `.`), `doctor` (boolean, default `true`) | none | `contents: read`; `pull-requests: read` for `pr-title` |
| `reusable-ai-review.yml` | claude-code-action with the code-review plugin, posting inline comments and a summary | `model` (default: Claude Code's default), `max-turns` (default 30) | `CLAUDE_CODE_OAUTH_TOKEN` | `contents: read`, `pull-requests: read`, `issues: read`, `id-token: write` (the Claude GitHub App posts the comments) |
| `reusable-release.yml` | `actions/create-github-app-token` → release-please | `release-type` (default `node`) | `RELEASE_APP_ID`, `RELEASE_APP_PRIVATE_KEY` | `contents: read`; writes go through the app token |

**Shared setup** lives in composite actions in the blueprint repo, referenced by full path at the same major, e.g.
`stavkamil/blueprint/.github/actions/setup@v1`. Inside a called workflow, a relative `./.github/actions` path would
resolve against the caller's checkout.
- **`setup`:** checkout (`persist-credentials: false`), `pnpm/action-setup` (version from `packageManager`), `actions/setup-node` (version from `.nvmrc`, pnpm cache), `pnpm install --frozen-lockfile`.
- **`gitleaks`:** downloads a pinned gitleaks release, verifies its checksum, and scans the PR's commit range. This works for personal and organization accounts alike, with no license key.

**`doctor` job:** runs `pnpm exec blueprint doctor --ci` when the `doctor` input is true. `--ci` always exits 0 and reports problems as annotations, so the job never shows red. It is **not** a dependency of `ci-ok`. Blueprint itself passes `doctor: false`.

**`ci-ok` aggregation:**
- The job id **and** `name:` are both `ci-ok`, so the check is exactly `ci / ci-ok`.
- It depends on `quality`, `pr-title` and `gitleaks` (not `doctor`) and runs with `if: always()`.
- It fails if any dependency failed or was cancelled. Skipped jobs (like `pr-title` on a push to `main`) count as passing.

## Caller files (the contract `project-template` writes)

`project-template` renders `@v<major>` from the installed blueprint version. These examples show 1.x.

```yaml
# .github/workflows/ci.yml
name: ci
on:
  pull_request:
    types: [opened, synchronize, reopened, edited, ready_for_review]
  push:
    branches: [main]
permissions: {}
concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }
jobs:
  ci:
    uses: stavkamil/blueprint/.github/workflows/reusable-checks.yml@v1
    permissions: { contents: read, pull-requests: read }
```

```yaml
# .github/workflows/ai-review.yml
name: ai-review
on:
  pull_request:
    types: [opened, ready_for_review]
  issue_comment:
    types: [created]
permissions: {}
jobs:
  review:
    if: >-
      github.actor != 'dependabot[bot]' &&
      ((github.event_name == 'pull_request' && !github.event.pull_request.draft) ||
       (github.event.issue.pull_request && startsWith(github.event.comment.body, '@claude review')))
    uses: stavkamil/blueprint/.github/workflows/reusable-ai-review.yml@v1
    permissions: { contents: read, pull-requests: read, issues: read, id-token: write }
    secrets:
      CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
```

```yaml
# .github/workflows/release.yml (only with --release)
name: release
on:
  push:
    branches: [main]
permissions: {}
jobs:
  release:
    uses: stavkamil/blueprint/.github/workflows/reusable-release.yml@v1
    permissions: { contents: read }
    secrets:
      RELEASE_APP_ID: ${{ secrets.RELEASE_APP_ID }}
      RELEASE_APP_PRIVATE_KEY: ${{ secrets.RELEASE_APP_PRIVATE_KEY }}
```

The required check is `ci / ci-ok`: the caller job `ci` plus the called job `ci-ok`. `cli-doctor` sets exactly this
name in the ruleset.

## AI review details

- **Action and plugin:** `anthropics/claude-code-action` (pinned SHA) with `plugin_marketplaces: https://github.com/anthropics/claude-code.git` and `plugins: code-review@claude-code-plugins`.
- **Prompt:** `/code-review:code-review --comment <repo>/pull/<number>`. The action's default `@claude` mode isn't used: a plain `@claude` mention starts a general run, while `@claude review` starts this exact review.
- **Allowed tools** are exactly what the plugin needs:
  - the inline-comment MCP tool
  - `Bash(gh pr view:*)`, `Bash(gh pr diff:*)`, `Bash(gh pr comment:*)`

  The plugin's command file is re-checked when its pin is updated.
- **What it judges against:**
  - The plugin reads `CLAUDE.md`. Every blueprint project's `CLAUDE.md` is `@AGENTS.md`, whose standards block points reviewers at `REVIEW.md` and `docs/standards/` (see SPEC-standards).
  - claude-code-action restores `CLAUDE.md` and `.claude/` from the base branch. `AGENTS.md` and `REVIEW.md` come from the PR itself. That's acceptable because only users with write access can trigger the review.
- **Limits:** `--max-turns` input, `timeout-minutes: 20`, and **job-level** `concurrency` per PR inside the reusable workflow. Comments that don't match `@claude review` skip the job, so they never cancel a running review.
- **No project code runs:** the job never runs `pnpm install` or project scripts while the token is present.

## Security posture

- **Permissions:** top-level `permissions: {}` everywhere; each job gets only its row in the table above.
- **Pinning:** third-party actions are pinned by full commit SHA with a version comment, and Dependabot (github-actions ecosystem) updates them. Blueprint's own workflows and actions use `@v<major>`, a tag only blueprint's release workflow moves. zizmor is configured to allow `stavkamil/blueprint/*@v*`.
- **Triggers:** no `pull_request_target`. `issue_comment` runs only the review, only for users with write access (the action checks this), with read-only repository permissions.
- **Secrets:** passed by name to the one workflow that needs each. Full output logging (`show_full_output`) stays off.
- **Untrusted input:** PR titles, bodies and comments never go straight into `run:` scripts. They pass through `env:` variables.

## Versioning

- Blueprint's release workflow (repo-foundation) moves the `v<major>` tag after each release. The first release is 1.0.0, so `v1` exists from the start.
- A **breaking change to this interface** is a major release (`v2`). Callers keep working on `v1` until they switch, and Dependabot proposes the switch as a PR. Breaking changes include:
  - renaming or removing an input or secret
  - renaming a job, which changes the required-check name
  - adding a required secret
- New optional inputs and fixes are minor or patch releases.

## Commands

```bash
pnpm lint:workflows       # actionlint + zizmor over .github/
```

Workflows run on GitHub. Blueprint's own workflows call these locally:
- `ci.yml` → `./.github/workflows/reusable-checks.yml` with `doctor: false`, plus blueprint's own `workflows-lint` job and its own top-level `ci-ok` (repo-foundation)
- `ai-review.yml` → `./.github/workflows/reusable-ai-review.yml`, with the same triggers as the project caller

## Project Structure

```
.github/
├── workflows/
│   ├── reusable-checks.yml     → workflow_call
│   ├── reusable-ai-review.yml  → workflow_call
│   ├── reusable-release.yml    → workflow_call
│   ├── ci.yml                  → blueprint's own (repo-foundation), calls reusable-checks locally
│   ├── ai-review.yml           → blueprint's own, calls reusable-ai-review locally
│   └── release.yml             → blueprint's own release + npm publish (repo-foundation)
├── actions/
│   ├── setup/action.yml        → checkout + pnpm + node + install
│   └── gitleaks/action.yml     → pinned, checksum-verified gitleaks scan
└── zizmor.yml                  → allows stavkamil/blueprint/*@v* refs
templates/base/.github/workflows/  → the caller files above (owned by project-template)
```

## Code Style

- Every job has a `name:` (equal to its id, so check names are predictable) and a `timeout-minutes:`.
- Every step that can fail has a `name:` that reads as an action ("Run lint").
- Failure messages use `::error title=…::` annotations with the local command to run.
- Shell steps use `set -euo pipefail` and read event data only from `env:`.

## Testing Strategy

- **Static:** actionlint + zizmor in blueprint's CI, zero findings (criterion 8).
- **Dogfood:** blueprint's PRs run `reusable-checks` and `reusable-ai-review` from local paths (criterion 10). A PR that breaks them can't merge.
- **Fixture project:** `reusable-checks` also runs against `tests/fixtures/ts-sample` (via `working-directory`, `doctor: false`) on blueprint's CI, proving it works on a project shaped like a real one.
- **Live:** one manual run on a throwaway private repo before v1 (criterion 11). Its steps are recorded in `docs/ci-live-check.md`.

## Boundaries

- **Always:**
  - Pin third-party actions by SHA.
  - Start from `permissions: {}`.
  - Pass event data through `env:`.
  - Keep `ci-ok` as the single aggregate.
  - Treat interface changes per the versioning rule.
- **Ask first:**
  - Adding a workflow, input or secret.
  - Changing a trigger.
  - Changing the AI review prompt, plugin, allowed tools or limits.
  - Adding any third-party action.
- **Never:**
  - Use `pull_request_target` or `secrets: inherit`.
  - Run project code in the AI review job.
  - Make AI review or `doctor` part of `ci-ok`.
  - Move a `v<major>` tag by hand.

## Success Criteria

- Acceptance criteria 1–11 pass.
- A new project's caller files total under 60 lines, with no CI logic in them.
- A CI fix released as `v1.x.y` reaches a project on its next PR with no change in the project.

## Resolved Questions

1. **AI review model:** Claude Code's default. The `model` input exists to switch later if Pro limits bite.
2. **Release for projects:** v1 creates a tag, a GitHub release and a changelog entry only. Publishing and deploys come in v2.
