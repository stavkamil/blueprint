# Capability Map: blueprint v1

Blueprint sets up an agent-first SDLC and CI/CD environment for new TypeScript projects.
It is a public repo plus a public npm package, `@stavkamil/blueprint`, with two CLI commands: `new` and `doctor`.
Projects are scaffolded once and then own their files. They stay consistent in two ways:

- **shared config packages**, updated by Dependabot
- **shared CI** referenced as `@v<major>`

Blueprint's first automated release is **1.0.0**, so `@v1` exists from day one.

## Modules

| Module id           | Responsibility                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Depends on                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `repo-foundation`   | Blueprint's own package skeleton (Node 24, pnpm, TypeScript 6.x, ESM, Vitest), organized by its own standards (`src/index.ts`, `src/commands/`, `src/modules/`, shared `utils/` and `lib/`). Also its CI (`ci-ok` aggregate), release-please with a GitHub App token, npm trusted publishing with provenance from `release.yml`, and automation that moves the `v<major>` tag                                                                                                                                                                                                                                 | —                                             |
| `standards`         | Agent-agnostic coding standards (TypeScript, React, unit tests, project structure). Two outputs: (1) plain-Markdown judgment guides in `standards/*.md`, copied into projects as `docs/standards/`, plus the AGENTS.md block (pointers + "Done means"); (2) the lint catalog that `config-presets` enforces. Written per writing-for-agents principles, based on established sources                                                                                                                                                                                                                          | `repo-foundation`                             |
| `config-presets`    | Shared config bases shipped in the package: ESLint (flat config implementing the lint catalog), tsconfig (TypeScript 6.x), Prettier, lefthook. No agent instruction files (agents load those before `node_modules` exists)                                                                                                                                                                                                                                                                                                                                                                                    | `repo-foundation`, `standards`                |
| `ci-workflows`      | Reusable workflows `reusable-checks.yml` (lint, typecheck, test, build, PR title, gitleaks, a `ci-ok` aggregate, a non-blocking doctor job), `reusable-ai-review.yml` (claude-code-action + code-review plugin; once on open or ready, then on `@claude review`; skipped for Dependabot; never required) and `reusable-release.yml` (opt-in release-please), plus SHA-pinned composite actions. Secrets are passed by name                                                                                                                                                                                    | `repo-foundation`                             |
| `project-template`  | Files a project gets once. **Base layer:** caller workflows pinned to `@v<installed major>`; `AGENTS.md` (owned by the project, with marked blocks managed by blueprint and, for nextjs, by Next.js); `CLAUDE.md` containing only `@AGENTS.md`; `docs/standards/` and `docs/blueprint.md` (owned by blueprint); `REVIEW.md`; Claude runtime files (settings, hooks, cloud-only SessionStart install); `lefthook.yml` (installed via `prepare`); Dependabot config (TypeScript majors ignored); PR template. **Type layers:** `ts` (default, built with plain `tsc`) and `nextjs` (overlay on create-next-app) | `config-presets`, `ci-workflows`, `standards` |
| `cli-doctor`        | `blueprint doctor`: checks the project locally and on GitHub. `--fix` repairs GitHub settings, creates missing files (also how an existing repo adopts blueprint), and refreshes only blueprint-owned files and blocks. It never edits files the project owns. Project options are derived from the repo (`package.json`, dependencies, release config). Secrets and the token's creation date come from the macOS Keychain. A missing GitHub Pro plan fails loudly. Local-only when there's no GitHub remote. `--ci` never fails the job                                                                     | `project-template`                            |
| `cli-new`           | `blueprint new <name> --description "…" [--type ts\|nextjs] [--release] [--public] [--no-github] [--resume]`: preflight, scaffold, `git init`, install (hooks), verify, commit, create the repo (private by default), `doctor --fix`. `--resume` continues a run that stopped at or after creating the repo. End-to-end self-test runs with `--no-github`                                                                                                                                                                                                                                                     | `project-template`, `cli-doctor`              |
| `new-project-skill` | The `/new-project` skill (Mac only, symlinked from the repo), plus guides: one-time setup (GitHub Pro, tools, Claude GitHub App on all repos, `claude setup-token` into the Keychain with its creation date, optional release app, cloud environment setup script with Node 24 + pnpm + gitleaks, phone settings) and phone use                                                                                                                                                                                                                                                                               | `cli-new`                                     |

## Build order

Lean order (2026-10-17): each step is one PR.

1. `config-presets`
2. `ci-workflows`
3. `project-template` + `cli-new` together: `blueprint new` creates a working project (GitHub repo creation included)
4. `cli-doctor`, **v1 scope only**: what `new` needs to lock down GitHub (see SPEC-cli-doctor, "v1 scope")
5. `new-project-skill`

→ **First real release** once `pnpm dlx @stavkamil/blueprint@1 new` works. Until then the release PR stays open and collects changes.

Done: `repo-foundation`, `standards`.

## Prerequisites (one time, by the user)

- GitHub Pro on `stavkamil` (rulesets on private repos)
- Claude GitHub App installed on all repositories
- `claude setup-token` for CI (a separate token, valid for one year, model-requests only), saved in the Keychain
- **Blueprint maintainer only** (see SPEC-repo-foundation): npm login with 2FA, the release GitHub App, and the one-time bootstrap publish

## Decisions log

- **2026-10-17, design review:**
  - Rulesets need GitHub Pro for private repos, so we buy Pro. `doctor` fails loudly without it.
  - Release-please is opt-in (`--release`), because PRs opened with the default `GITHUB_TOKEN` don't trigger CI.
  - Claude files are scaffolded into the project, not loaded from `node_modules`.
- **Standards are agent-agnostic:**
  - Checkable rules become ESLint (or compiler flags); guidance lives in plain Markdown (`docs/standards/`); `AGENTS.md` is the instruction file and `CLAUDE.md` only imports it.
  - No rule-conversion tools (Ruler, rulesync). Claude-only path-scoped rules are deferred to v2.
- **Cut from v1:** osv-scanner (overlaps with Dependabot), a separate token-expiry workflow (`doctor` covers it), a bundler for `ts`.
- **Rejected:** Copier, custom sync manifests, actions-template-sync, Claude plugins for project tooling (cloud sessions don't install repo-declared plugins).
- **2026-10-17, cross-spec review:**
  - TypeScript is pinned to 6.x: TypeScript 7 has no programmatic API yet, so typescript-eslint can't run on it. Moving to 7 will be blueprint v2.
  - First automated release is 1.0.0.
  - Reusable workflows are named `reusable-*.yml`, separate from blueprint's own workflows.
  - Blueprint follows its own standards.
  - `ts` projects also get the one-line `CLAUDE.md`, because the review plugin reads `CLAUDE.md`.
- **2026-10-17, lean process:** one PR per module, plans in the PR description, releases only at milestones. `cli-doctor` is cut to a v1 scope; `project-template` and `cli-new` are built together.
- **Deferred to v2:** deploys and project publishing, daily status routine, nightly scans, Semgrep, iOS, TypeScript 7.

## Specs

Each module has `SPEC-<module-id>.md` in this folder (`docs/specs/`). Its implementation plan is a short task list in
the module's PR description; finished plans from the first two modules are in `tasks/done/`.
