# Todo: repo-foundation

Plan: [plan.md](plan.md). Spec: [SPEC-repo-foundation.md](../docs/specs/SPEC-repo-foundation.md).

---

## Task 0: Install local CLIs

**Description:** Install the CLIs the hooks and workflow linters call, so local checks behave like CI.

**Acceptance criteria:**

- [x] `gitleaks version`, `actionlint --version` and `zizmor --version` all succeed

**Verification:**

- [x] Manual check: the three commands print versions

**Dependencies:** None (needs your approval to run `brew install gitleaks actionlint zizmor`)

**Files likely touched:** none (system tools)

**Estimated scope:** XS

---

## Task 1: Skeleton and CLI stub

**Description:** Create the git repo and the package in blueprint's own layout, with a CLI that answers `--version` and `--help` and rejects unknown flags with a helpful message.

**Acceptance criteria:**

- [x] `git init -b main`; an initial commit holds only `docs/specs/` and `tasks/`; work continues on branch `feat/repo-foundation`
- [x] `package.json`: name `@stavkamil/blueprint`, version `0.0.0`, `type: module`, `bin: { blueprint: dist/index.js }`, `engines.node >=22.18`, `packageManager` pinned, `typescript ~6.0.3`; `.nvmrc` = 24
- [x] `node src/index.ts --version` and `node dist/index.js --version` print `0.0.0`; `--help` prints usage; an unknown flag exits 1 with "run `blueprint --help`"

**Verification:**

- [x] Tests pass: `pnpm test` (`src/index.spec.ts`, `src/utils/version.spec.ts` call `run(argv)` directly)
- [x] Build succeeds: `pnpm build` produces `dist/index.js` (not `dist/src/…`)
- [x] Manual check: `pnpm dev -- --help`

**Dependencies:** None

**Files likely touched:** `package.json`, `tsconfig.json`, `tsconfig.build.json`, `.nvmrc`, `.gitignore`, `src/index.ts`, `src/index.spec.ts`, `src/utils/version.ts`, `src/utils/errors.ts`

**Estimated scope:** M

---

## Task 2: Lint, format and coverage gate

**Description:** Add ESLint (flat config with typescript-eslint type-checked rules, plus the standards the code must already meet), Prettier, and Vitest coverage at 80% lines, wired to the package scripts.

**Acceptance criteria:**

- [x] `pnpm lint` (`eslint . && prettier --check .`), `pnpm typecheck` and `pnpm test` (with coverage) pass from a clean clone
- [x] Code that uses `function` declarations, default exports, `any`, or exports without JSDoc fails `pnpm lint` (spot-checked, then reverted)
- [x] Coverage below 80% fails `pnpm test`

**Verification:**

- [x] Tests pass: `pnpm test`
- [x] Build succeeds: `pnpm build`
- [x] Manual check: `rm -rf node_modules && pnpm install && pnpm lint && pnpm typecheck && pnpm test`

**Dependencies:** Task 1

**Files likely touched:** `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `vitest.config.ts`, `package.json`

**Estimated scope:** S

---

## Task 3: Smoke test

**Description:** `pnpm smoke` packs the package, installs the tarball into a temp folder and runs the installed `blueprint --version`, proving the published shape works.

**Acceptance criteria:**

- [x] `pnpm smoke` exits 0 and prints the installed version
- [x] The tarball contains `dist/` and `package.json`, and no `src/`, tests or specs (checked from the `pnpm pack` file list)

**Verification:**

- [x] Manual check: `pnpm build && pnpm smoke`

**Dependencies:** Task 2

**Files likely touched:** `scripts/smoke.ts`, `package.json` (`files`, `smoke` script)

**Estimated scope:** S

---

## Checkpoint A: package works

- [x] `pnpm install && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm smoke` all pass
- [ ] Review with you

---

## Task 4: Git hooks

**Description:** lefthook runs Prettier, ESLint (staged files) and gitleaks before each commit, and typecheck + tests before each push.

**Acceptance criteria:**

- [x] `pnpm install` installs the hooks (`prepare: lefthook install`); `.git/hooks/pre-commit` and `pre-push` are lefthook's
- [x] Committing a file with a fake secret fails with gitleaks' finding; committing a normal one-file change takes under 5 seconds
- [x] Pushing with a failing test is blocked

**Verification:**

- [x] Manual check: the three scenarios above, then revert

**Dependencies:** Tasks 0, 2

**Files likely touched:** `lefthook.yml`, `package.json`

**Estimated scope:** S

---

## Task 5: Agent and repo docs

**Description:** Write the files agents and humans read first, following the writing-for-agents principles.

**Acceptance criteria:**

- [x] `AGENTS.md` (under 60 lines): commands, boundaries from the spec, pointers to `docs/specs/` and `tasks/`, and a "Done means" checklist. `CLAUDE.md` is exactly `@AGENTS.md`
- [x] `README.md` (what, install, use), `LICENSE` (MIT), `.github/pull_request_template.md` (Summary, Testing, Risk, How to revert, Agent session)
- [x] `docs/maintainer-setup.md` holds the spec's one-time setup steps, each with a check

**Verification:**

- [x] Manual check: Prettier passes on the docs, and a fresh agent session can find the commands and boundaries from AGENTS.md alone

**Dependencies:** Task 2

**Files likely touched:** `AGENTS.md`, `CLAUDE.md`, `README.md`, `LICENSE`, `.github/pull_request_template.md`, `docs/maintainer-setup.md`

**Estimated scope:** M

---

## Task 6: CI workflow

**Description:** `ci.yml` runs on PRs and pushes to `main`. Jobs:

- `checks`: install, lint, typecheck, test, build, smoke
- `pr-title`: Conventional Commits, on PR events
- `gitleaks`: the PR's commit range
- `workflows-lint`: actionlint + zizmor
- `ci-ok`: aggregates the four above, with job id and name both `ci-ok`

**Acceptance criteria:**

- [x] Top-level `permissions: {}`; each job grants only what it needs; every third-party action pinned by full SHA with a version comment; checkouts use `persist-credentials: false`
- [x] `ci-ok` uses `if: always()` and fails when any dependency failed or was cancelled (skipped counts as pass)
- [x] `pnpm lint:workflows` (actionlint + zizmor) reports zero findings

**Verification:**

- [x] Manual check: `pnpm lint:workflows`
- [ ] Real run happens in task 11

**Dependencies:** Tasks 0, 3

**Files likely touched:** `.github/workflows/ci.yml`, `.github/zizmor.yml`, `package.json` (`lint:workflows`)

**Estimated scope:** S

---

## Task 7: Release workflow

**Description:** `release.yml` on push to `main` does three things:

1. Creates a token from the `blueprint-release` app and runs release-please.
2. When a release is created, publishes to npm through trusted publishing (`id-token: write`, npm ≥ 11.5.1, provenance automatic).
3. Moves the `v<major>` tag to the release commit.

**Acceptance criteria:**

- [x] `release-please-config.json` (node, `release-as: 1.0.0`) and `.release-please-manifest.json` (`0.0.0`)
- [x] `package.json` publish fields: `files: ["dist"]`, `publishConfig: { access: "public" }`, `repository` set (npm requires it for provenance)
- [x] The publish job has no npm token anywhere; the tag move runs only after a successful publish
- [x] `pnpm lint:workflows` reports zero findings

**Verification:**

- [x] Manual check: `pnpm lint:workflows`; `pnpm pack --dry-run` lists only `dist/`, `package.json`, `README.md`, `LICENSE`
- [ ] Real run happens in task 11

**Dependencies:** Task 6

**Files likely touched:** `.github/workflows/release.yml`, `release-please-config.json`, `.release-please-manifest.json`, `package.json`

**Estimated scope:** S

---

## Task 8: Dependabot and ruleset definition

**Description:** Weekly grouped Dependabot updates (npm, github-actions) with TypeScript majors ignored, and the `main` ruleset as a JSON file ready for `gh api`.

**Acceptance criteria:**

- [x] `dependabot.yml`: npm weekly with minor+patch grouped, majors separate, `typescript` major ignored; github-actions weekly grouped
- [x] `.github/rulesets/main.json`: PR required (0 approvals), conversation resolution, required check `ci-ok` with up-to-date branches, squash-only merges, force-push and deletion blocked, no bypass actors

**Verification:**

- [x] Manual check: both files validate (`actionlint` doesn't cover Dependabot; checked by schema with `npx -y ajv-cli` or by GitHub on first push in task 9)

**Dependencies:** Task 6

**Files likely touched:** `.github/dependabot.yml`, `.github/rulesets/main.json`

**Estimated scope:** XS

---

## Checkpoint B: everything local is done

- [x] Phase 1 commands pass; `pnpm lint:workflows` reports zero findings
- [x] Every third-party action pinned by SHA
- [ ] Review with you before anything goes to GitHub or npm

---

## Task 9: GitHub repo, push and protection (needs your approval)

**Description:** Create the public repo, push, apply protection, and open the first PR.

1. Create `stavkamil/blueprint` (public).
2. Push `main` (initial commit only).
3. Apply the ruleset and the merge settings (squash only, PR title as commit title, delete branch on merge).
4. Open the first PR from `feat/repo-foundation`.

**Acceptance criteria:**

- [ ] `gh repo view stavkamil/blueprint` shows public, with the description set
- [ ] `gh api repos/stavkamil/blueprint/rulesets` lists the ruleset; a direct push to `main` is rejected
- [ ] The PR from `feat/repo-foundation` runs CI and shows the `ci-ok` check

**Verification:**

- [ ] Manual check: the three commands/observations above

**Dependencies:** Checkpoint B, your approval

**Files likely touched:** none (GitHub state)

**Estimated scope:** S

---

## Task 10: Your one-time setup (you)

**Description:** Following `docs/maintainer-setup.md` steps 3–6:

1. You create the `blueprint-release` GitHub App, install it on all repositories, and add `RELEASE_APP_CLIENT_ID` and `RELEASE_APP_PRIVATE_KEY` as repo secrets.
2. The foundation PR is merged, and release-please opens "release 1.0.0" (left open).
3. You run `npm login` (2FA) and `npm publish` of `0.0.0` from `main`, so the package exists.
4. You add the trusted publisher (`stavkamil/blueprint`, `release.yml`) and set "Require 2FA and disallow tokens".

The npm name can only be claimed once `main` contains the package, so the bootstrap publish comes after the foundation PR merges.

**Acceptance criteria:**

- [ ] `gh secret list -R stavkamil/blueprint` shows both release secrets
- [ ] "release 1.0.0" PR is open with CI run on it
- [ ] `npm view @stavkamil/blueprint version` prints `0.0.0`; trusted publisher configured; same sitting as task 11 (2-day window)

**Verification:**

- [ ] Manual check: the commands above

**Dependencies:** Task 9

**Files likely touched:** none

**Estimated scope:** S

---

## Task 11: Prove the pipeline

**Description:** Prove the guardrails, then ship the first release.

**Acceptance criteria:**

- [ ] A throwaway PR with a bad title, a failing test, or a fake secret is blocked, and each failure says how to fix it (then closed)
- [ ] Merging the "release 1.0.0" PR publishes `1.0.0` with provenance and creates `v1.0.0` + `v1`
- [ ] `pnpm dlx @stavkamil/blueprint@1 --version` prints `1.0.0` from a folder outside the repo; a follow-up PR removes `release-as`

**Verification:**

- [ ] Manual check: npm page shows the provenance badge; `git ls-remote --tags origin` shows `v1`

**Dependencies:** Task 10

**Files likely touched:** `release-please-config.json` (follow-up PR)

**Estimated scope:** S

---

## Checkpoint C: module complete

- [ ] Spec acceptance criteria 1–10 and success criteria pass
- [ ] Spec updated with anything learned; next: `standards` and `ci-workflows`
