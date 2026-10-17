# Implementation Plan: repo-foundation

Spec: [docs/specs/SPEC-repo-foundation.md](../docs/specs/SPEC-repo-foundation.md) (module 1 of 8, see the
[capability map](../docs/specs/CAPABILITY-MAP.md)). The task checklist is in [todo.md](todo.md).

## Overview

Build blueprint's own package and pipeline:
- a TypeScript 6 package in blueprint's own layout
- a CLI stub (`--version`, `--help`)
- local quality tooling and git hooks
- CI with a single `ci-ok` check
- release-please with a GitHub App token
- npm trusted publishing
- Dependabot and a `main` ruleset

The local part (tasks 1–8) needs nothing outside this machine. The GitHub and npm part (tasks 9–11) creates public things
and needs your approval and a few steps only you can do.

## Facts checked while planning (2026-10-17)

| Fact | Consequence |
|---|---|
| `typescript@latest` is **7.0.2**; latest 6.x is **6.0.3** | Pin `typescript: ~6.0.3` |
| `typescript-eslint` 8.71.2 supports `typescript >=4.8.4 <6.1.0` and `eslint ^8.57 \|\| ^9 \|\| ^10` | TS 6.0.x is supported. ESLint 10 (latest, 10.13.0) is fine |
| Local: Node 24.21.0, pnpm 12.11.2, git 2.54 with identity set | Matches the spec |
| Local: **gitleaks, actionlint, zizmor and lefthook are not installed** | lefthook comes in as a dev dependency. The three CLIs need `brew install gitleaks actionlint zizmor` (task 0, your approval) |
| Folder is not a git repo yet | Task 1 runs `git init` and puts the work on a branch |

## Architecture decisions

- **Blueprint's own layout from day one:** `src/index.ts` (entry and bin), `src/commands/`, `src/modules/`, `src/utils/`, `src/lib/`. Tests are `*.spec.ts` next to the code.
- **Local configs first:** ESLint, Prettier and tsconfig start as plain local files. `config-presets` (module 3) later swaps them for blueprint's own presets.
  - The local ESLint config already enforces the standards the code must meet now: arrow functions, named exports, JSDoc on exports, no `any`. That means module 3 doesn't force a rewrite.
- **Hand-written CI now, reusable later:** CI is written directly in `ci.yml` now. `ci-workflows` (module 4) moves the checks into `reusable-checks.yml`, keeping `ci-ok` as the required check name.
- **Version starts at 1.0.0:** `package.json` starts at `0.0.0` (the version you publish by hand to claim the name), and release-please's `release-as: 1.0.0` makes the first automated release 1.0.0.
- **No runtime dependencies.** Dev dependencies use the latest stable versions, except TypeScript (`~6.0.3`).

## Dependency graph

```
0 tools (brew) ─────────────────────────────┐
1 skeleton + CLI stub (git, package, tsconfig, src, tests)
├── 2 lint + format + coverage gate
│   ├── 3 smoke test (pack → install → run)
│   └── 4 git hooks (lefthook) ← needs 0 for gitleaks
├── 5 agent + repo docs (AGENTS.md, CLAUDE.md, README, LICENSE, PR template, maintainer setup)
└── 6 CI workflow (checks, pr-title, gitleaks, workflows-lint, ci-ok) ← needs 0 for local actionlint/zizmor
    └── 7 release + publish workflow (+ publish fields, release-please config)
        └── 8 Dependabot + ruleset definition
            └── 9 GitHub repo + push + ruleset + merge settings   [approval]
                └── 10 your one-time setup: release app, npm bootstrap, trusted publisher   [you]
                    └── 11 prove it: bad-PR check, first release 1.0.0, pnpm dlx check
```

## Task list

### Phase 1: Working package (local)
- [ ] Task 0: Install local CLIs (gitleaks, actionlint, zizmor), with your approval
- [ ] Task 1: Skeleton and CLI stub: `blueprint --version` and `--help` work from source and from `dist/`
- [ ] Task 2: Lint, format and coverage gate: `pnpm lint`, `pnpm typecheck`, `pnpm test` pass from a clean clone
- [ ] Task 3: Smoke test: `pnpm smoke` installs the packed tarball and runs `blueprint --version`

### Checkpoint A: package works
- [ ] `pnpm install && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm smoke` all pass
- [ ] Review with you

### Phase 2: Guardrails and pipeline files (local)
- [ ] Task 4: Git hooks: pre-commit (format, lint, gitleaks) under 5s; pre-push (typecheck, test)
- [ ] Task 5: Agent and repo docs: AGENTS.md, CLAUDE.md, README, LICENSE, PR template, maintainer setup guide
- [ ] Task 6: CI workflow: checks, PR title, gitleaks, workflow linters, `ci-ok`
- [ ] Task 7: Release workflow: release-please (app token), npm publish with provenance, move `v<major>`
- [ ] Task 8: Dependabot config and ruleset definition

### Checkpoint B: everything local is done
- [ ] All Phase 1 commands pass; `pnpm lint:workflows` reports zero findings
- [ ] Every third-party action pinned by SHA
- [ ] Review with you before anything goes to GitHub or npm

### Phase 3: Live on GitHub and npm (approval needed)
- [ ] Task 9: Create the public repo, push, apply the ruleset and merge settings
- [ ] Task 10: Your one-time setup: release app + secrets, npm login + `0.0.0` bootstrap publish, trusted publisher
- [ ] Task 11: Prove it: a deliberately bad PR is blocked; the first release publishes 1.0.0 with provenance and the `v1` tag

### Checkpoint C: module complete
- [ ] Spec acceptance criteria 1–10 and success criteria all pass
- [ ] Spec updated with anything learned; ready to start `standards` and `ci-workflows`

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| A tool (ESLint plugin, Vitest, lefthook) misbehaves with TS 6 / ESLint 10 / pnpm 12 | Med | Task 1–2 install and run everything first; fall back to ESLint 9 if a needed plugin lacks ESLint 10 support |
| Running `.ts` directly fails on a TS 6 feature Node can't strip | Low | `erasableSyntaxOnly` is on, which guarantees strippable syntax; task 1 verifies `node src/index.ts` |
| pnpm 12 blocks lefthook's install script | Low | `prepare: lefthook install` installs hooks regardless (task 4 verifies `.git/hooks`) |
| Trusted publisher's 2-day window passes before the first release | Med | Task 10 is done right before task 11, in one sitting |
| The release PR doesn't run CI | High | The app token is used for release-please; task 11 checks CI ran on the release PR |
| `release-as: 1.0.0` left in config | Low | Task 11 removes it in a follow-up PR after 1.0.0 ships |

## Parallelization

Tasks 3, 4 and 5 are independent once task 2 is done. Task 6 needs only task 1. They're small, so one session doing
them in order is simpler than coordinating several.

## Open questions

1. **Task 0:** OK for me to run `brew install gitleaks actionlint zizmor` on your Mac? (Otherwise you run it.)
2. **Branching before GitHub exists:** I'll work on a local branch `feat/repo-foundation` and push it as the first PR in task 9, so even the first change goes through CI and review. `main` gets one initial commit with only `docs/specs` and `tasks/`. OK?
