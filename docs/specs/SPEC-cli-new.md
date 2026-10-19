# Spec: cli-new

Module 7 of 8 in [CAPABILITY-MAP.md](CAPABILITY-MAP.md). Depends on `project-template` and `cli-doctor`.

**Built together with `project-template` in one PR** (lean order, 2026-10-17). `cli-new` uses `cli-doctor`'s v1 scope for securing GitHub.
`new-project-skill` depends on it.

**As built (2026-10-18), differences from the design below:**

- **All steps and flags are built** (step 7–8 and `--resume` landed with `cli-doctor` v1). Step 8 is the re-check `runDoctor({ fix: true })` already does, so `new` runs doctor once. The Keychain isn't checked in preflight: a missing item becomes a manual step from doctor, and `--resume` finishes the run afterwards.
- **`--resume`** reads the options back with `deriveTemplateOptions`, refuses (exit 2) without a committed project, then runs only "Create repo" and "Secure". "Create repo" is idempotent: when `origin` exists it only pushes.
- **`--json`** prints `{ ok, resumable, project: { name, dir, type, url? }, steps: [{ id, status }], problems: [{ message, hint, output? }], doctor?, manualSteps, resumeCommand? }`. The resume command adds `--dir` when the parent folder isn't the current one.
- **Exit code 2** also covers usage errors (unknown option, missing name or description), across the whole CLI: nothing was done.
- **Install** runs `pnpm install --no-frozen-lockfile`, because CI environments default to a frozen lockfile and a new project has none.
- **Layout:** the process runner is `src/lib/run-command.ts`, and the steps are one list in `src/modules/scaffold/steps.ts` rather than one file each.
- **End-to-end** (`tests/e2e/new.spec.ts`) calls `runScaffold` directly with GitHub off, installing blueprint from the packed tarball (the published 1.0.0 predates the presets).
- **Found by the end-to-end test:** the `ci.yml` caller contract put `${{ github.ref }}` inside a YAML flow map, which is invalid YAML. It's block style now (SPEC-ci-workflows updated).

## Objective

`blueprint new` turns one command into a fully set-up project:

- scaffolded by type
- verified locally
- committed
- pushed to a new GitHub repo
- secured by `blueprint doctor --fix`

It never prompts: the `/new-project` skill (or you) supplies every answer as flags, so the same command works from a
terminal, from the skill, or from a script.

**Users:** the `/new-project` skill (main caller, via `--json`), and you directly in a terminal.

**Scope:** flags, preflight checks, the step sequence, failure handling and `--resume`, output, and the end-to-end self-test.
**Out of scope:**

- the interview (`new-project-skill`)
- file contents (`project-template`)
- checks and fixes (`cli-doctor`)
- adopting existing repos (that's `doctor --fix`)

### Acceptance criteria

1. **ts, GitHub-free:** `blueprint new demo --type ts --description "…" --no-github` creates `./demo`, which passes lint, typecheck, test (coverage ≥ 80%) and build. It has one commit on `main`, made with the lefthook hooks installed (including the gitleaks scan), and the run finishes in under 60 seconds after dependencies are cached.
2. **nextjs, GitHub-free:** the same command with `--type nextjs` produces a project that passes the same checks, with Next's managed AGENTS.md block kept and the blueprint block added.
3. **Full run:** with GitHub (on the throwaway setup used by the other live checks), the result is:
   - a private repo with `main` pushed
   - secrets set from the Keychain
   - settings and ruleset applied
   - `blueprint doctor` passing, with `app.claude` pending until the first review

   CI runs on the first PR and `ci / ci-ok` passes.

4. **Preflight refuses before anything is created.** No folder, files or repo appear when any of these fail:
   - invalid name
   - existing non-empty folder
   - repo name already taken on GitHub
   - missing `pnpm`, `git`, `gitleaks` or `gh`, or `gh` logged out
   - no git `user.name`/`user.email`
   - Node older than 22.18

   Each failure prints its fix.

5. **Local verification gate.** If lint, typecheck, test or build fails on the fresh project (a blueprint bug), the run stops **before** any GitHub repo is created, keeps the folder for inspection, and says so.
6. **Resumable after GitHub.**
   - Any failure at or after the "Create repo" step is resumable: the message says exactly `blueprint new <name> --resume`.
   - `--resume` continues from the first step whose result is missing: create the repo if it doesn't exist, push if `main` isn't pushed, then secure and report. It's idempotent.
   - Failures before that step (scaffold to commit) are reported as **not resumable**, with the folder path kept for inspection.
   - `new` never deletes a repo, or a folder it didn't create in this run.
7. **`--json` for the skill.** It prints one object: `{ ok, resumable, project: { name, dir, type, url? }, steps: [{ id, status }], doctor, manualSteps: [string], resumeCommand? }`.
8. **Quiet success output.** Human output is one line per step (`✓ Scaffolded (nextjs)`), then a short summary: repo URL, manual steps left, and one "next" line (open it in Claude Code).

## Commands

```bash
blueprint new <name> --description "<one line>" [--type ts|nextjs] [--release] [--public] [--no-github] [--dir <parent>] [--json]
blueprint new <name> --resume [--dir <parent>] [--json]
```

| Flag            | Default                           | Meaning                                                                                            |
| --------------- | --------------------------------- | -------------------------------------------------------------------------------------------------- |
| `<name>`        | required                          | kebab-case, 1–100 chars; becomes the folder, package and repo name                                 |
| `--description` | required (except with `--resume`) | one line for AGENTS.md, README, `package.json` and the GitHub repo description                     |
| `--type`        | `ts`                              | `ts` or `nextjs`                                                                                   |
| `--release`     | off                               | adds release-please and sets the release-app secrets                                               |
| `--public`      | off (private)                     | creates a public repo                                                                              |
| `--no-github`   | off                               | stops after the local commit (used by the self-test)                                               |
| `--resume`      | off                               | continues a run that stopped at or after creating the repo; options are read back from the project |
| `--dir`         | current directory                 | parent folder for the project                                                                      |
| `--json`        | off                               | machine-readable result, no progress lines                                                         |

**Exit codes:**

- `0`: success (manual steps may remain)
- `1`: failed after creating something. The output says whether it's resumable and how.
- `2`: preflight refused, nothing created

## Step sequence

| #   | Step            | Details                                                                                                                                                                                                                                                                                     | On failure                                                               |
| --- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 0   | **Preflight**   | name valid; target folder absent or empty; tools present: `node ≥ 22.18`, `pnpm`, `git` with `user.name`/`user.email`, `gitleaks`, and `gh` logged in unless `--no-github`; `gh repo view <owner>/<name>` returns not-found; Keychain items present (missing ones → listed in manual steps) | exit 2, nothing created                                                  |
| 1   | **Scaffold**    | **ts:** create the folder and write `renderTemplate(...)`. **nextjs:** run create-next-app (flags below), then write the overlay, merge `package.json` and upsert the blueprint block into AGENTS.md                                                                                        | exit 1, not resumable; keep folder                                       |
| 2   | **Init git**    | `git init -b main` (before install, so hooks can be installed)                                                                                                                                                                                                                              | exit 1, not resumable                                                    |
| 3   | **Install**     | `pnpm install` (creates the lockfile; `prepare` runs `lefthook install`)                                                                                                                                                                                                                    | exit 1, not resumable                                                    |
| 4   | **Verify**      | `pnpm lint && pnpm typecheck && pnpm test && pnpm build`                                                                                                                                                                                                                                    | exit 1, not resumable; "this is a blueprint bug" with the failing output |
| 5   | **Commit**      | `git add -A`, commit `chore: initial commit from blueprint v<version>` (hooks run, including gitleaks)                                                                                                                                                                                      | exit 1, not resumable                                                    |
| 6   | **Create repo** | `gh repo create <name> --private\|--public --description … --source . --push`                                                                                                                                                                                                               | exit 1, resumable                                                        |
| 7   | **Secure**      | `runDoctor({ fix: true })`: settings, ruleset (after the push, since the ruleset blocks direct pushes to `main`), Actions permissions, Dependabot security, secrets from the Keychain                                                                                                       | exit 1, resumable                                                        |
| 8   | **Report**      | `runDoctor()` once more; print summary and manual steps                                                                                                                                                                                                                                     | —                                                                        |

Steps 6–8 are skipped with `--no-github`.

**create-next-app invocation** (every option is explicit, so stored create-next-app preferences can't change the result):

```bash
pnpm create next-app@<pinned major> <name> --ts --tailwind --eslint --no-react-compiler --app --src-dir \
  --cache-components --import-alias "@/*" --use-pnpm --agents-md --no-agent-feedback --skip-install --disable-git --yes
```

The pinned major is a constant in blueprint. The weekly nextjs end-to-end job (project-template) catches breaking
changes to flags or output.

## Design

- Steps are data (`{ id, title, run, isDone, skipWhen }`) executed in order by one runner. `isDone` checks whether a step's result already exists, which is what `--resume` uses to skip completed steps.
- All external commands go through the shared process runner and `gh` client in `src/lib/` (`execFile`, no shell, arguments as arrays).
- Template rendering, option derivation, the package.json merge and the marked-block helper come from `src/utils/template/`. Checks and fixes come from `runDoctor`. `new` adds no setup logic beyond the sequence.
- **Composition follows blueprint's standards:** the `scaffold` module owns steps 0–6. `src/commands/new.ts` (an entry point) runs the scaffold steps, then the doctor module for steps 7–8, so modules never import each other.
- `packageManager` in the new project is set to the pnpm version that ran the command.

```ts
/** Ordered local setup steps; the runner stops at the first failure and reports whether it can be resumed. */
export const scaffoldSteps: readonly Step[] = [
  preflight,
  scaffold,
  initGit,
  install,
  verify,
  commit,
  createRepo,
];
```

## Project Structure

```
src/commands/new.ts               → parses flags; runs scaffold steps, then doctor (secure + report)
src/modules/scaffold/
├── run.ts                        → runScaffold(options) → ScaffoldResult
├── options.ts                    → flag validation (node:util parseArgs)
├── steps/*.ts                    → one file per step
├── nextjs.ts                     → create-next-app invocation + overlay application
└── *.spec.ts
tests/e2e/new.spec.ts             → criteria 1, 2, 4, 5 (no GitHub)
```

## Testing Strategy

- **Unit:**
  - option validation (every refusal in criterion 4)
  - step ordering, stop-on-failure, and `isDone` skipping for `--resume`
  - resumable vs. not-resumable messages (criterion 6)
  - `--json` shape (criterion 7)

  The process runner is a fake that records calls, so tests assert that `gh repo create` never runs after a failed verify step, and that a resumed run skips steps whose result exists.

- **End-to-end, no GitHub:**
  - `ts` runs in the normal CI job against the locally packed tarball.
  - `nextjs` runs in the network CI job (same schedule as project-template's).
- **Live (manual, before v1):** criterion 3 on the throwaway setup, plus one forced failure after "Create repo", resumed with `--resume`. The run's output is saved as `docs/new-live-check.md`.

## Boundaries

- **Always:**
  - Run every preflight check before creating anything.
  - Verify locally before creating a repo.
  - Report whether a failure is resumable, and the exact command.
- **Ask first:**
  - Adding a flag or step.
  - Changing the create-next-app flags or pinned major.
  - Adding interactive prompts (the design is non-interactive on purpose).
- **Never:**
  - Delete a GitHub repo.
  - Delete a folder `new` didn't create in this run.
  - Push before local verification passes.
  - Print secrets.
  - Duplicate a check or fix that `cli-doctor` owns.

## Success Criteria

- Acceptance criteria 1–8 pass.
- From the command to a repo with green CI on the first PR, the only manual work is the one-time setup (GitHub Pro, Claude app, Keychain items), and doctor names each item if it's missing.

## Resolved Questions

1. **create-next-app options:** React Compiler off, Next.js agent feedback off, Cache Components on, all passed explicitly.
2. **Description:** `--description` is required (except with `--resume`).
