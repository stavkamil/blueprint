# Spec: cli-doctor

Module 6 of 8 in [CAPABILITY-MAP.md](CAPABILITY-MAP.md). Depends on `project-template`. `cli-new` depends on it.

## v1 scope (lean, decided 2026-10-17)

**v1 builds only what `blueprint new` needs to lock down a fresh GitHub repo:**

- the GitHub checks and fixes `gh.ready`, `repo.merge`, `repo.ruleset` (including the loud GitHub Pro failure), `actions.permissions` and `security.dependabot`
- `secret.claude` and `secret.release`: the secret exists, set from the Keychain
- the local check `hooks.installed`
- `blueprint doctor` and `doctor --fix`, plus `runDoctor` for `cli-new`

**Deferred until a real need shows up:**

- the other local checks (`files.required` and adopting existing repos, `agents.block`, `agents.claude-md`, `docs.current`, `ci.callers`, `package.*`, `claude.settings`, `gitleaks.available`)
- `app.claude`, token-age tracking, `--ci` and the CI doctor job, `--json`
- `--local`, `--type` and `--description`

The rest of this spec stays as the design those checks will follow when they're added.

## Objective

`blueprint doctor` checks that a project still matches the blueprint setup, locally and on GitHub. `--fix` repairs
what blueprint owns. It's the single place that knows what "correctly set up" means:

- `blueprint new` ends by running it
- you run it any time something feels off
- CI runs its local part without ever failing the job
- in an existing repo, `doctor --fix` is how that repo adopts blueprint

**Users:** you (terminal), `cli-new` (programmatic), agents (via `--json`), CI (via `--ci`).

**Scope:** the check catalog, the fixes, output and exit codes, and secret handling.
**Out of scope:**

- creating projects and repos (`cli-new`)
- the template contents (`project-template`)
- scanning all your repos at once (v2)

### Acceptance criteria

1. **Fresh project, clean result.** A freshly created project (both types, with or without `--release`) passes every applicable check. Output is one line (`blueprint doctor: all checks passed`) and the exit code is 0. Two cases aren't failures:
   - `app.claude` reports **pending** until the first AI review has run.
   - A project with no GitHub remote runs local checks only and says so in one line.
2. **Every check has a failing test** that triggers it and asserts the message and the exact fix command.
3. **`--fix` repairs and is idempotent.** It repairs every check marked _auto_, then re-runs the checks. Running it twice in a row makes no changes and no API writes the second time.
4. **Owned paths only.** `--fix` never modifies a project-owned file. It may:
   - create a **missing** project file from the template (never overwriting)
   - replace blueprint-owned paths and the marked `blueprint-standards` block in `AGENTS.md`
5. **No GitHub Pro, loud failure.** On a private repo where GitHub refuses the ruleset because the account lacks GitHub Pro, doctor fails with: what's wrong, why it matters ("agents could push to main"), and two fixes (upgrade to Pro, or make the repo public).
6. **Secrets stay secret.** They're read from the macOS Keychain and passed to `gh secret set` through stdin. They never appear in arguments, output, logs or `--json`.
7. **CI mode never fails the job.** `--ci` runs local checks only, prints GitHub annotations (`::error` / `::warning`) for problems, and **always exits 0**. It never needs a token beyond the default `GITHUB_TOKEN`.
8. **Agent-readable output.** `--json` prints one JSON object (`{ ok, checks: [{ id, status, message, fix }] }`) for agents and `cli-new`. `status` is one of `pass`, `fail`, `warn`, `pending`, `skipped`.
9. **Few API calls, fast.** Each GitHub resource is fetched once and shared across checks: repo, ruleset list plus the `blueprint-main` ruleset, Actions permissions, secret list, security settings, latest `ai-review` run. That's under 15 API calls, and a full run takes under 10 seconds on a normal connection.

## Commands

```bash
blueprint doctor                # all checks, report only
blueprint doctor --fix          # repair what's fixable, then re-check
blueprint doctor --local        # skip GitHub checks (no network)
blueprint doctor --ci           # local checks, annotations, always exits 0
blueprint doctor --json         # machine-readable result (combinable with --fix / --local)
blueprint doctor --fix --type ts|nextjs --description "…"   # adopting an existing repo whose options can't be derived
```

**Exit codes:**

- `0`: no errors (warnings and pending allowed); always `0` with `--ci`
- `1`: at least one error
- `2`: doctor couldn't run (not a git repo; `gh` missing or logged out while a GitHub remote exists; project options not derivable and not given). Every exit-2 message includes the command that fixes it.

**Project options** (type, name, description, release) come from `deriveTemplateOptions` (project-template). When a
value can't be derived, typically in an existing repo, doctor asks for the matching flag in its exit-2 message.

## Check catalog

Severity: **error** = the setup is broken or unsafe. **warning** = drift that should be fixed soon.
Fix: **auto** = `--fix` does it. **manual** = doctor prints the exact command or step.

### Local (no network)

| ID                   | Checks                                                                                                                                                                | Severity | Fix                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------ |
| `files.required`     | Every project file from the template exists (AGENTS.md, CLAUDE.md, REVIEW.md, configs, CI callers, Dependabot, PR template, `.claude/settings.json` and hooks)        | error    | auto: create missing files only                                          |
| `agents.block`       | AGENTS.md has the `blueprint-standards` block, identical to the installed version's                                                                                   | warning  | auto: upsert the block                                                   |
| `agents.claude-md`   | `CLAUDE.md` contains exactly `@AGENTS.md`. More content would make it the real instructions and hide AGENTS.md from other agents                                      | error    | manual: move content into AGENTS.md and reduce CLAUDE.md to `@AGENTS.md` |
| `docs.current`       | `docs/standards/` and `docs/blueprint.md` match the installed package's copies                                                                                        | warning  | auto: replace both                                                       |
| `ci.callers`         | `ci.yml` and `ai-review.yml` (and `release.yml` with release) call `stavkamil/blueprint/.github/workflows/reusable-*.yml@v<installed major>` and pass secrets by name | error    | manual: show the expected caller file                                    |
| `package.scripts`    | `lint`, `typecheck`, `test`, `build` and `prepare` exist; `test` runs coverage                                                                                        | error    | manual: show the expected entries                                        |
| `package.preset`     | `@stavkamil/blueprint` is a devDependency and `node_modules` holds the version in the lockfile                                                                        | error    | manual: the exact `pnpm add -D …` / `pnpm install` command               |
| `hooks.installed`    | `.git/hooks/pre-commit` and `pre-push` are lefthook's                                                                                                                 | error    | auto: `pnpm exec lefthook install`                                       |
| `claude.settings`    | `.claude/settings.json` contains the required deny and ask rules (other entries are free)                                                                             | error    | manual: print the missing lines                                          |
| `gitleaks.available` | the `gitleaks` binary is on PATH (skipped in `--ci`, where CI installs it)                                                                                            | warning  | manual: `brew install gitleaks`                                          |

### GitHub (via `gh`, using your login; skipped when there's no `origin` remote on github.com)

| ID                    | Checks                                                                                                                                                                                                                                                             | Severity        | Fix                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- | ----------------------------------------------------------------------------------------- |
| `gh.ready`            | `gh` is installed and logged in, and `origin` is a github.com repo you own                                                                                                                                                                                         | exit 2          | manual: `gh auth login`                                                                   |
| `repo.merge`          | squash merge only; squash title = PR title, message = PR body; delete branch on merge                                                                                                                                                                              | error           | auto: `PATCH /repos/{owner}/{repo}`                                                       |
| `repo.ruleset`        | ruleset `blueprint-main` on the default branch, no bypass actors, with: PR required (0 approvals, since you can't approve your own PRs), conversation resolution required, required check `ci / ci-ok` with up-to-date branches, force-push and deletion blocked   | error           | auto: create or update the ruleset **by name**; a 403 asking for an upgrade → criterion 5 |
| `actions.permissions` | default workflow token is read-only; Actions can't approve PRs                                                                                                                                                                                                     | error           | auto: `PUT /repos/{owner}/{repo}/actions/permissions/workflow`                            |
| `security.dependabot` | vulnerability alerts and Dependabot security updates are on                                                                                                                                                                                                        | error           | auto: enable both                                                                         |
| `secret.claude`       | `CLAUDE_CODE_OAUTH_TOKEN` exists and matches the Keychain token's age (see below)                                                                                                                                                                                  | error / warning | auto: set from Keychain; manual if the Keychain item is missing or expiring               |
| `secret.release`      | with `release.yml` present: `RELEASE_APP_CLIENT_ID` and `RELEASE_APP_PRIVATE_KEY` exist                                                                                                                                                                            | error           | auto: set from Keychain items `release-app-client-id` and `release-app-key`               |
| `app.claude`          | the Claude GitHub App is installed for the repo. `gh`'s login can't list app installations (GitHub only allows that for app tokens), so doctor checks indirectly: **pending** before any `ai-review` run, **pass** if the latest run didn't fail on authentication | warning         | manual: link to github.com/apps/claude with "All repositories"                            |

**About the GitHub Pro check:** doctor doesn't read your plan, because `gh`'s default login can't see it without an extra
permission. Instead it creates or updates the ruleset, and treats GitHub's "upgrade" refusal as the signal. That's the
exact failure that matters, and it needs no extra login scope.

**Token age** (one Keychain token is copied into every repo, so a repo secret's own date says nothing about the token):

- The setup guide saves the token with its creation date in the Keychain item's comment (`created:YYYY-MM-DD`).
- **Warning** from 30 days before the token's one-year expiry: "create a new token with `claude setup-token`, save it, then run `blueprint doctor --fix` in each repo".
- **Error** once it has expired.
- **Warning, auto-fixed:** the repo secret was last updated before the Keychain token was created, meaning the repo still holds an older token.
- **Warning:** the Keychain item has no creation date, with the command to save it again with one.

**Release key format:** the app's private key spans multiple lines, so the setup guide stores it **base64-encoded** in
the Keychain. Doctor decodes it in memory and sends the original PEM to `gh secret set` via stdin.

## Output (DX rules)

- **Success:** one line. Silent otherwise.
- **Each failure:** `✗ <title>`, one line of _why it matters_, one line `→ <exact command or step>`. Grouped under **Errors**, **Warnings**, then **Pending**.
- **`--fix`:** each change is listed as `fixed: <title>`, then the re-check result.
- **No spinners or colors** when output isn't a terminal (CI, `--json`, pipes).

```
blueprint doctor: 1 error, 1 warning

Errors
✗ Ruleset on main is missing
  Without it, agents can push straight to main.
  → blueprint doctor --fix

Warnings
✗ docs/standards is behind blueprint 1.4.0
  Agents read outdated standards.
  → blueprint doctor --fix
```

## Design

Each check is data plus two functions. Context (repo info, package version, file reads, GitHub resources) is loaded once
and shared:

```ts
export const Severity = { Error: "error", Warning: "warning" } as const;
export type Severity = (typeof Severity)[keyof typeof Severity];

export type Check = {
  readonly id: string;
  readonly title: string;
  readonly scope: Scope; // Scope.Local | Scope.GitHub
  readonly severity: Severity;
  readonly run: (context: DoctorContext) => Promise<CheckResult>;
  readonly fix?: (context: DoctorContext) => Promise<void>; // absent = manual
};
```

- **GitHub calls** go through one `gh` client in `src/lib/gh.ts` (`execFile`, no shell), injected so tests can replace it.
- **Keychain reads** (`src/lib/keychain.ts`) use `security find-generic-password -s blueprint -a <account> -w`, plus `-g` output for the comment carrying the creation date. Values go straight to `gh secret set <NAME>` via stdin. On non-macOS systems, doctor prints the manual `gh secret set` command instead.
- **Template rendering, option derivation and the marked-block helper** are reused from `src/utils/template/` (project-template).
- **The ruleset is identified by name** (`blueprint-main`), so doctor never touches other rulesets you create.

## Cross-module change

**`ci-workflows`:** `reusable-checks.yml` has a `doctor` job that runs `pnpm exec blueprint doctor --ci`. It isn't part of `ci-ok`, so it reports drift without blocking merges. Blueprint itself turns it off with `doctor: false`.

## Project Structure

Follows blueprint's own layout (SPEC-repo-foundation):

```
src/commands/doctor.ts            → parses flags, calls runDoctor, formats output
src/modules/doctor/
├── run.ts                        → runDoctor(options) → DoctorResult (also used by commands/new.ts)
├── context.ts                    → loads repo, package and GitHub data once
├── checks/
│   ├── local/*.ts                → one file per local check
│   └── github/*.ts               → one file per GitHub check
├── output.ts                     → human, --ci and --json formatting
└── *.spec.ts
src/lib/gh.ts, src/lib/keychain.ts → system clients shared with cli-new
```

## Testing Strategy

- **Unit, one per check:** a passing case, a failing case (asserting message + fix text), and for fixable checks a fix case followed by a passing re-check. The `gh` client and Keychain are fakes that record calls, so idempotency (criterion 3) and "secret only on stdin" (criterion 6) are asserted from the recorded calls.
- **Fixture projects:** a temp copy of a rendered project, broken in specific ways (block removed, CLAUDE.md with content, hooks missing, no remote), run through `runDoctor`.
- **Live (manual, before v1):** on the throwaway private repo used by ci-workflows. A bare repo fails as expected, `--fix` repairs it, and the second run passes. Also a free-plan scenario if available, to see the criterion-5 message.

## Boundaries

- **Always:**
  - Fetch each GitHub resource once per run.
  - Show the exact fix for every failure.
  - Pass secrets only through stdin.
  - Re-check after fixing.
- **Ask first:**
  - Adding a check or changing a severity.
  - Adding a fix that writes to GitHub.
  - Requesting any extra `gh` scope.
- **Never:**
  - Overwrite a project-owned file.
  - Create or delete a repository.
  - Delete anything on GitHub other than updating its own `blueprint-main` ruleset.
  - Change repo visibility.
  - Print, log or return a secret value.
  - Exit non-zero with `--ci`.

## Success Criteria

- Acceptance criteria 1–9 pass.
- The live run takes a bare GitHub repo to fully passing with one `--fix`, apart from steps only you can do (GitHub Pro, the Claude app, the Keychain items), each named with its exact action.

## Resolved Questions

1. **Creating missing files on `--fix`:** yes. This is also how an **existing** repo adopts blueprint: run `pnpm dlx @stavkamil/blueprint@1 doctor --fix` in it (adding `--type`/`--description` if asked), then apply the printed manual steps (for example adding the dev dependencies). It only creates files, never overwrites.
2. **Keychain storage:** yes. The Claude token (with its creation date) and the release-app credentials (key base64-encoded) live once in the macOS Keychain under service `blueprint`, and doctor copies them into each repo.
