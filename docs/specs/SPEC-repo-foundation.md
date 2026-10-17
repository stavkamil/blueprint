# Spec: repo-foundation

Module 1 of 8 in [CAPABILITY-MAP.md](CAPABILITY-MAP.md). No dependencies.

## Objective

Give blueprint itself a solid, publishable TypeScript package and a pipeline that the later modules build on.
When this module is done, blueprint can be developed by agents, checked on every PR, released with a changelog,
and published to npm with provenance, all without manual steps after one-time setup. Blueprint follows its own
standards (folder layout, naming, tests, JSDoc), so it's always tested on itself.

**User:** the maintainer (you), plus the agents working in this repo, locally and in cloud sessions.

**Scope:** the package skeleton, a CLI stub (`--version`, `--help`), blueprint's own CI, release, publishing,
Dependabot, and the repo ruleset.
**Out of scope:** config presets, shared workflows for projects, templates, and the `new`/`doctor` commands
(later modules).

### Acceptance criteria

1. **Clean clone works.** `pnpm install && pnpm lint && pnpm typecheck && pnpm test && pnpm build` pass from a clean clone.
2. **CLI stub.** `node dist/index.js --version` prints the `package.json` version, and `--help` lists usage. An unknown flag exits 1 with a message saying what to run instead.
3. **Smoke test.** The packed tarball (`pnpm pack`) installs into a temp folder and `blueprint --version` runs successfully.
4. **One required check.** Every PR to `main` runs CI. A single job named `ci-ok`, defined in blueprint's own `ci.yml`, passes only if every other CI job passed: checks, PR title, gitleaks, and the workflow linters.
5. **PR titles.** A PR title that isn't a Conventional Commit (`feat:`, `fix:`, `chore:`…) fails CI with a message showing the expected format.
6. **Release PRs run CI.** Merging a `feat:`/`fix:` PR makes release-please open or update a release PR, **and CI runs on that PR**.
7. **Release and publish.** Merging the release PR creates a GitHub release and tag, publishes to npm via trusted publishing with provenance (no npm token anywhere), and moves the `v<major>` tag to the release commit. The first automated release is **1.0.0**.
8. **Ruleset.** The `main` ruleset requires a PR, requires `ci-ok`, requires conversations resolved, allows squash merges only, and blocks force-pushes and deletion.
9. **Dependabot.** Dependabot opens at most one grouped PR per week for npm and one for GitHub Actions. Security updates arrive immediately. TypeScript major versions are ignored (see Tech Stack).
10. **Security scans.** gitleaks, actionlint and zizmor run in CI, and any finding fails `ci-ok`.

## Tech Stack

- **Runtime:** Node 24 for development, pinned in `.nvmrc`. `engines.node` is `>=22.18`, the first Node 22 that runs `.ts` files directly; trusted publishing needs 22.14+.
- **Package manager:** pnpm, pinned via `packageManager` in `package.json`.
- **Language:** **TypeScript 6.x** (pinned `~6.<latest minor>`), strict, ESM only (`"type": "module"`).
  - TypeScript 7 has no programmatic API yet, so typescript-eslint can't run on it. Moving to 7 is a planned blueprint v2. Re-check typescript-eslint's support before pinning.
  - `verbatimModuleSyntax`, `erasableSyntaxOnly` and `rewriteRelativeImportExtensions` are on. Source imports use `.ts` extensions, and `tsc` rewrites them to `.js`.
  - `types: ["node"]` and `rootDir: "src"` are set explicitly, because TS 6 changed their defaults.
- **Build:** plain `tsc` to `dist/` (no bundler). The `bin` points to `dist/index.js`.
- **CLI parsing:** `node:util` `parseArgs` (no CLI framework).
- **Quality:** ESLint flat config + typescript-eslint, Prettier, Vitest + `@vitest/coverage-v8`, lefthook. These start as local configs; `config-presets` replaces them with blueprint's own presets.
- **CI security:** gitleaks, actionlint, zizmor. Every third-party action is pinned by commit SHA.
- **Release:** release-please (`googleapis/release-please-action`), using a token from a GitHub App (`actions/create-github-app-token`). Its config sets `release-as: 1.0.0` for the first release, removed afterwards.
- **Publish:** `npm publish` in `release.yml`, using OIDC trusted publishing (npm CLI ≥ 11.5.1). Provenance is automatic for a public repo and package.
- **Runtime dependencies:** none in this module. Dev dependencies use the latest stable versions (TypeScript excepted), locked by `pnpm-lock.yaml`.

## Commands

```bash
pnpm install                 # install (CI uses: pnpm install --frozen-lockfile)
pnpm dev -- --help           # run the CLI from source (node src/index.ts)
pnpm lint                    # eslint . && prettier --check .
pnpm lint:workflows          # actionlint && zizmor .github/
pnpm format                  # prettier --write . && eslint . --fix
pnpm typecheck               # tsc --noEmit
pnpm test                    # vitest run --coverage
pnpm test:watch              # vitest
pnpm build                   # tsc -p tsconfig.build.json  → dist/
pnpm smoke                   # pack the tarball, install it in a temp dir, run `blueprint --version`
```

## Project Structure

Blueprint uses the `ts` layout from its own standards. This module creates the skeleton; later modules fill the reserved
folders.

```
blueprint/
├── src/
│   ├── index.ts             → entry point (bin "blueprint"): three lines that call `run` and set the exit code
│   ├── commands/            → one file per command; composes modules (entry element)
│   │   └── main.ts          → `run(argv, io)`: parses flags, dispatches commands, returns the exit code (tested in main.spec.ts)
│   ├── modules/             → (reserved: doctor, scaffold) one folder per domain; modules never import each other
│   ├── utils/               → pure shared helpers (version, errors, output; later: template rendering)
│   └── lib/                 → system clients (process runner; later: gh, Keychain)
├── scripts/
│   └── smoke.ts             → pack + install + run check (pnpm smoke)
├── presets/                 → (reserved: config-presets)
├── tsconfig/                → (reserved: config-presets)
├── standards/               → (reserved: standards)
├── templates/               → (reserved: project-template)
├── skill/                   → (reserved: new-project-skill)
├── .github/
│   ├── workflows/
│   │   ├── ci.yml           → blueprint's own CI: checks, PR title, gitleaks, workflow linters, ci-ok
│   │   ├── release.yml      → blueprint's own release: release-please → npm publish → move v<major> (the trusted-publisher file)
│   │   └── reusable-*.yml   → (reserved: ci-workflows)
│   ├── actions/             → (reserved: ci-workflows composite actions)
│   ├── rulesets/main.json   → ruleset definition, applied with gh api
│   ├── dependabot.yml
│   └── pull_request_template.md
├── docs/
│   ├── maintainer-setup.md  → one-time setup for this repo
│   └── specs/               → CAPABILITY-MAP.md + SPEC-<module-id>.md (the source of truth for what to build)
├── AGENTS.md                → agent guide for this repo (commands, boundaries, pointers to specs and standards)
├── CLAUDE.md                → `@AGENTS.md`
├── package.json, pnpm-lock.yaml, tsconfig.json, tsconfig.build.json, .nvmrc
├── eslint.config.js, vitest.config.ts, lefthook.yml
├── README.md, LICENSE, .gitignore
```

Once `ci-workflows` exists, `ci.yml` calls `./.github/workflows/reusable-checks.yml` (with `doctor: false`, since
blueprint isn't a blueprint project). It keeps its own `workflows-lint` job (actionlint + zizmor) and its own `ci-ok`
job aggregating both. The required check stays `ci-ok`.

## Code Style

Blueprint follows its own standards: arrow functions, named exports, JSDoc on every export, `.spec.ts` tests, and
errors that tell the user what to do next.

```ts
// src/utils/version.ts
import { readFile } from "node:fs/promises";

import { BlueprintError } from "./errors.ts";

/** Reads blueprint's own version so `--version` and generated files always match the installed package. */
export const readPackageVersion = async (packageJsonUrl: URL): Promise<string> => {
  const pkg: unknown = JSON.parse(await readFile(packageJsonUrl, "utf8"));
  if (typeof pkg !== "object" || pkg === null || !("version" in pkg) || typeof pkg.version !== "string") {
    throw new BlueprintError(
      "Could not read the blueprint version.",
      "Reinstall the package: pnpm dlx @stavkamil/blueprint@latest --version",
    );
  }
  return pkg.version;
};
```

- User-facing output: one line of what happened, one line of what to do. Silent on success except the requested result.
- Everything else follows [SPEC-standards.md](SPEC-standards.md).

## Testing Strategy

- **Framework:** Vitest. Tests sit next to the code (`src/**/*.spec.ts`).
- **CLI behavior:** tests call the exported `run(argv)` function rather than spawning processes. The tarball smoke test (`pnpm smoke`) covers the real binary.
- **Coverage:** at least 80% of lines in `src/`, enforced in `vitest.config.ts`.
- **Workflows:** actionlint and zizmor validate YAML. The release and publish path is verified once end to end with the first real release (acceptance criteria 6 and 7).
- **Local hooks (lefthook):**
  - pre-commit: Prettier and ESLint on staged files, plus gitleaks (target under 5 seconds)
  - pre-push: `pnpm typecheck && pnpm test`

## Boundaries

- **Always:**
  - Run `pnpm lint && pnpm typecheck && pnpm test` before committing.
  - Use Conventional Commit PR titles. Keep PRs small.
  - Pin new GitHub Actions by full commit SHA with a version comment.
  - Update the relevant spec when a decision changes.
- **Ask first:**
  - Adding any dependency (runtime or dev).
  - Editing anything in `.github/` (workflows, rulesets, Dependabot).
  - Changing `package.json` publish fields (`name`, `bin`, `files`, `exports`, `publishConfig`).
  - Changing the ruleset or npm package settings.
  - Changing the TypeScript pin.
- **Never:**
  - Commit secrets, tokens or `.npmrc` credentials.
  - Run `npm publish` locally after the one-time bootstrap publish.
  - Push to or force-push `main`.
  - Weaken checks (lower coverage, skip tests, disable lint rules) to get green.
  - Edit `dist/` by hand.

## One-time setup (done by you, documented in `docs/maintainer-setup.md`)

1. **Repo.** Create the public GitHub repo `stavkamil/blueprint` and push the first commit.
2. **Release app.** Create the GitHub App `blueprint-release` (Contents and Pull requests: read & write), install it on all repositories, and save `RELEASE_APP_ID` and `RELEASE_APP_PRIVATE_KEY` as secrets in this repo. The same app serves projects created with `--release` (see `new-project-skill`'s setup guide).
3. **npm.** Log in (`npm login`, 2FA on). Publish `0.0.0` once by hand to claim the name. Then add a trusted publisher (repo `stavkamil/blueprint`, workflow `release.yml`) and set "Require two-factor authentication and disallow tokens". The first trusted publish (1.0.0) must happen within 2 days of adding the publisher.
4. **Ruleset.** `gh api repos/stavkamil/blueprint/rulesets --method POST --input .github/rulesets/main.json`.
5. **Merge settings.** In repo settings, allow squash merges only, with the PR title as the commit title.

## Success Criteria

- Acceptance criteria 1–10 pass.
- `1.0.0` is published with the npm provenance badge visible, the `v1` tag exists, and `pnpm dlx @stavkamil/blueprint@1 --version` prints `1.0.0` on a machine that never cloned the repo.
- A deliberately bad PR (non-conventional title, failing test, or a fake secret) is blocked from merging, and each failure message says how to fix it.

## Resolved Questions

1. **npm username:** `stavkamil`, so the package is `@stavkamil/blueprint`.
2. **Release token:** a GitHub App, created once and reused. Projects that opt in to releases reuse the same app.
3. **License:** MIT.
4. **TypeScript:** 6.x until typescript-eslint supports TypeScript 7.
5. **First version:** 1.0.0, so `@v1` exists from the first release.
