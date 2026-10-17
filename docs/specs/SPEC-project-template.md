# Spec: project-template

Module 5 of 8 in [CAPABILITY-MAP.md](CAPABILITY-MAP.md). Depends on `config-presets`, `ci-workflows` and `standards`.
`cli-doctor` and `cli-new` depend on it.

## Objective

Define every file a new project gets, once, at creation: the agent instructions, the quality configs that point at the
presets, the CI caller files, the Claude runtime settings, and a minimal source skeleton. After creation the project owns
these files. The only exceptions are two blueprint-owned areas that `doctor --fix` keeps current.

**Users:** `cli-new` (renders and writes the files), `cli-doctor` (knows what a correct project looks like), and every
agent that later works in the project.

**Scope:** template layers, their file contents, the render function's interface, the Next.js overlay, and file
ownership.
**Out of scope:**

- running `create-next-app`, git and GitHub setup (`cli-new`)
- checking and fixing (`cli-doctor`)
- the content of `docs/standards/` (`standards`)

### Acceptance criteria

1. **Pure render.** `renderTemplate(options)` returns the complete file set (path → content) for a `ts` project, and the overlay set for a `nextjs` project. Same input, same output: no clock, no network, no randomness.
2. **ts project works end to end.** A rendered `ts` project in a temp folder passes `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (coverage ≥ 80%) and `pnpm build`, with no edits.
3. **nextjs project works end to end.** A `nextjs` project (create-next-app, then the overlay) passes the same five commands. This runs in a separate, slower CI job because it needs the network.
4. **AGENTS.md:**
   - is under 60 lines
   - contains the blueprint standards block between `<!-- BEGIN:blueprint-standards -->` and `<!-- END:blueprint-standards -->` (from `standards/agents-block.md`)
   - for `nextjs`, keeps Next.js's own managed `<!-- BEGIN:nextjs-agent-rules -->` block unchanged
5. **CLAUDE.md:** exactly the single line `@AGENTS.md`, in both project types (create-next-app generates the same file for nextjs). Claude Code and the AI review plugin, which reads `CLAUDE.md`, see the same instructions as every other agent.
6. **Tiny configs.** Every config file that extends a preset (`eslint.config.js`, `tsconfig.json`, `lefthook.yml`, the Prettier field) is 1–10 lines and copies no rule lists.
7. **CI callers.** The workflow files match the caller contract in [SPEC-ci-workflows.md](SPEC-ci-workflows.md#caller-files-the-contract-project-template-writes) byte for byte, with `@v<major>` rendered from the installed blueprint version. `release.yml` and the release-please files exist only with `release: true`.
8. **Claude runtime settings** (`.claude/settings.json`):
   - The common commands run without prompts.
   - Agents must ask before editing workflows or adding dependencies.
   - Secrets, force-pushes, merges and repo administration are denied.
   - In cloud sessions, the SessionStart hook installs dependencies, and only there.
9. **Ownership is machine-readable.** `ownership` lists every path and marked block as `Owner.Project`, `Owner.Blueprint` or `Owner.Framework` (Next.js). `cli-doctor` reads that list and touches only blueprint-owned paths and blocks.
10. **Options can be recovered from a project.** `deriveTemplateOptions(dir)` rebuilds the options from an existing project, so `doctor` can create missing files without asking. The sources: name and description from `package.json`, type from whether `next` is a dependency, release from whether `release-please-config.json` exists.

## Layers

| Layer     | Applied when     | Contents                                                                                                                                                       |
| --------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `base`    | always           | Agent files, quality configs, CI callers, Claude settings, docs, skeleton shared by both types                                                                 |
| `ts`      | `type: "ts"`     | `src/index.ts` skeleton, tsconfig (node), Vitest (node env), `build` = `tsc`                                                                                   |
| `nextjs`  | `type: "nextjs"` | Overlay applied **on top of create-next-app's output**: replaces its ESLint config, extends its tsconfig, adds Vitest + Testing Library, merges `package.json` |
| `release` | `release: true`  | `.github/workflows/release.yml`, `release-please-config.json`, `.release-please-manifest.json`                                                                 |

**Composition:** later layers override files at the same path. `package.json` is the one file that's **deep-merged** (base partial + type partial, plus create-next-app's file for nextjs), so dependencies and scripts combine.

**Render interface** (consumed by `cli-new` and `cli-doctor`):

```ts
type TemplateOptions = {
  readonly projectName: string;   // kebab-case, validated
  readonly description: string;   // one line, used in AGENTS.md and README
  readonly type: ProjectType;     // const object: ProjectType.Ts | ProjectType.Nextjs
  readonly release: boolean;
  readonly blueprintVersion: string; // the installed version; its major renders the @v<major> caller refs
};
renderTemplate(options: TemplateOptions): ReadonlyMap<string, string>
mergePackageJson(existing: PackageJson | undefined, options: TemplateOptions): PackageJson
deriveTemplateOptions(projectDir: string): Promise<TemplateOptions>   // for doctor on existing projects
ownership: ReadonlyMap<string, Owner>      // path, glob or marked block → Owner.Project | Owner.Blueprint | Owner.Framework
```

Placeholders in template files (`{{projectName}}`, `{{description}}`, `{{blueprintMajor}}`) are replaced by plain string substitution, with no template engine.

## Files (base layer)

**Agent instructions**

- `AGENTS.md` (project-owned, except the marked blueprint block):
  1. `# {{projectName}}` plus the one-line description
  2. **Commands**: `pnpm dev`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm format`
  3. **Boundaries**:
     - **Ask first:** adding a dependency, editing `.github/`, changing `.claude/settings.json`
     - **Never:** commit secrets, push to `main`
  4. The **blueprint standards block** (pointers + "Done means"), between markers
  5. **Project notes**: an empty section for the project's own conventions
  6. nextjs only: Next.js's managed block, left exactly as create-next-app wrote it
- `CLAUDE.md`: the single line `@AGENTS.md` (both types)
- `REVIEW.md` (project-owned):
  - **What failure looks like here**: a placeholder the project fills in, plus defaults: broken behavior, missing tests for new logic, standards violations
  - **Evidence**: every finding cites `file:line`
  - **Summary**: start with the number of findings, and say "no issues" when there are none
  - **Skip**: lockfiles, generated files, `docs/standards/`
  - **Standards**: judge code against `docs/standards/`

**Docs (blueprint-owned)**

- `docs/standards/*.md`, copied from `standards/`
- `docs/blueprint.md`: what blueprint set up, which paths blueprint owns, how updates arrive (Dependabot for presets, `@v<major>` for CI, `doctor --fix` for docs and the marked block)

**Quality configs (project-owned, pointing at presets)**

- `eslint.config.js`:
  - ts: `import { ts } from "@stavkamil/blueprint/eslint"; export default [...ts];`
  - nextjs: Next's `core-web-vitals` config first, then `...nextjs`
- `tsconfig.json`: `extends` the matching preset, plus `include`. nextjs adds `paths: { "@/*": ["./src/*"] }`
- `lefthook.yml`: `extends: [node_modules/@stavkamil/blueprint/presets/lefthook/base.yml]`
- `vitest.config.ts`:
  - coverage thresholds of 80% lines
  - excludes Next.js route files, config files, `**/*.d.ts`, `**/types.ts` and generated code
  - nextjs adds the `jsdom` environment and the React plugin
- `package.json` (merged):
  - `"name"`, `"description"` (the one-line description, also used by `deriveTemplateOptions`), `"type": "module"`, `"private": true`, `packageManager` (pnpm, pinned), `engines.node >= 22.18`
  - `"prettier": "@stavkamil/blueprint/prettier"`
  - scripts: `dev`, `lint` (`eslint . && prettier --check .`), `format`, `typecheck` (`tsc --noEmit`), `test` (`vitest run --coverage`), `build`, `prepare` (`lefthook install`, which also covers pnpm skipping lefthook's own install script)
  - dependencies: `zod`
  - devDependencies: `@stavkamil/blueprint`, `eslint`, `prettier`, `typescript` (`~6.x`, matching blueprint's pin), `lefthook`, `vitest`, `@vitest/coverage-v8`, `@types/node`
  - nextjs adds: `@testing-library/react`, `@testing-library/user-event`, `@testing-library/dom`, `jsdom`, `@vitejs/plugin-react` (`eslint-config-next` comes from create-next-app)
- `pnpm-workspace.yaml`: `allowBuilds: { lefthook: false }`. pnpm 12 **fails the install** when a dependency's build script is neither allowed nor denied. Denying lefthook's script is safe because `prepare` installs the hooks (found while building repo-foundation).
- `.nvmrc`: `24`
- `.gitignore`: Node, coverage, `.env*` (except `.env.example`), and `.next/` for nextjs
- `.prettierignore`: `dist/`, `coverage/`, `pnpm-lock.yaml`, `.next/` (nextjs), and `CHANGELOG.md`. release-please writes the changelog in its own format, which would otherwise fail `prettier --check` on every release PR (found on blueprint's first release PR).
- **Starter tests never hard-code the package version.** They read it from `package.json`, because release PRs bump it (same finding).

**CI and repo (project-owned)**

- `.github/workflows/ci.yml` and `ai-review.yml`: the exact caller files from SPEC-ci-workflows
- `.github/dependabot.yml`:
  - npm: weekly, one group for minor + patch, majors as separate PRs; TypeScript major versions ignored (blueprint moves to TypeScript 7 as one coordinated release); `@types/node` major versions ignored, since they follow the Node major in `.nvmrc` (Dependabot proposed jumping to 26 on blueprint)
  - github-actions: weekly, grouped
  - security updates arrive immediately (GitHub's default)
- `.github/pull_request_template.md`: sections **Summary**, **Testing** (commands run and their result), **Risk**, **How to revert**, **Agent session** (link, filled in by agents running in cloud sessions)

**Claude runtime (project-owned)**

- `.claude/settings.json`:
  - `permissions.allow`:
    - `Bash(pnpm lint*)`, `Bash(pnpm typecheck)`, `Bash(pnpm test*)`, `Bash(pnpm build)`, `Bash(pnpm format)`, `Bash(pnpm install --frozen-lockfile)`
    - read-only git: `status`, `diff`, `log`
    - `git add`, `git commit`, `git switch -c`, `git push -u origin <branch>`
    - `gh pr create`, `gh pr view`, `gh pr checks`, `gh pr comment`
  - `permissions.ask`:
    - `Edit(.github/workflows/**)`, `Write(.github/workflows/**)`
    - `Edit(.claude/settings.json)`
    - `Bash(pnpm add*)`, `Bash(pnpm remove*)`
  - `permissions.deny`:
    - `Read(.env*)` (except `.env.example`), `Read(**/*.pem)`
    - `Bash(git push --force*)`, `Bash(git push origin main*)`
    - `Bash(gh pr merge*)`, `Bash(gh repo delete*)`, `Bash(gh secret*)`, `Bash(gh api*rulesets*)`
  - `sandbox.enabled: true`, with `.github/workflows/` write-protected at the sandbox level, so shell commands can't get around the ask rule. The exact key comes from the Claude Code settings reference and is checked during implementation.
  - `hooks.SessionStart` → `.claude/hooks/session-start.sh`
  - `hooks.PostToolUse` (Edit/Write) → `.claude/hooks/format-file.sh`
- `.claude/hooks/session-start.sh`: exits immediately unless `CLAUDE_CODE_REMOTE=true`, then runs `pnpm install --frozen-lockfile` (skipped when `node_modules` is already current)
- `.claude/hooks/format-file.sh`: runs Prettier on the edited file only, silent on success

**Skeleton (project-owned)**

- `src/config/env.ts`: Zod schema for environment variables, parsed once, with an exported typed `env`. This models the boundary-validation standard.
- `src/config/env.spec.ts`: one behavior test for it
- `.env.example`: the variables `env.ts` expects, with no values
- `README.md`: three short sections (what it is, how to run it, where agents look: `AGENTS.md`)

## Files (type layers)

**`ts`**

- `src/index.ts`: one exported arrow function with JSDoc, plus `src/index.spec.ts`
- `tsconfig.build.json`: `rootDir: "src"`, `outDir: "dist"`, excludes spec files (so `src/index.ts` builds to `dist/index.js`)
- scripts: `dev` = `node --watch src/index.ts`, `build` = `tsc -p tsconfig.build.json`

**`nextjs`** (overlay on create-next-app's output, run with TypeScript, Tailwind, ESLint, App Router, `src/` dir, `@/*` alias, pnpm, and agent files on)

- **Replace:**
  - `eslint.config.mjs` → `eslint.config.js` (blueprint composition)
  - create-next-app's `README.md` → blueprint's
- **Merge:**
  - `tsconfig.json`: switch to the preset via `extends`, keep `paths` and Next's `include`
  - `package.json`: as described above
  - `AGENTS.md`: blueprint content around Next's managed block, which stays untouched
- **Keep:** `CLAUDE.md` (`@AGENTS.md`), `src/app/*`, Tailwind config, `next.config.ts`
- **Add:** `vitest.config.ts`, `vitest.setup.ts` (Testing Library matchers), `src/app/page.spec.tsx` (renders the home page and finds its heading by role)
- **Fix up create-next-app's generated files to pass the standards:** default exports stay (route files are exempt), the home page gets kebab-case helpers if it has any, and JSDoc is added where needed. Criterion 3 proves it.

## File ownership

| Owner                 | Paths                                                                                    | Who changes them after creation                                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `blueprint`           | `docs/standards/**`, `docs/blueprint.md`, the `blueprint-standards` block in `AGENTS.md` | Only `blueprint doctor --fix` (replaced whole)                                                                                           |
| `framework` (Next.js) | the `nextjs-agent-rules` block in `AGENTS.md`                                            | Only `next dev` / Next.js tooling                                                                                                        |
| `project`             | everything else                                                                          | The project, freely. `doctor` checks some invariants (e.g. the CI callers point at `@v<installed major>`) but never rewrites these files |

The marked-block pattern is the one Next.js uses for its own managed instructions. Blueprint copies it, so both tools
manage their own section of `AGENTS.md` without touching each other's or the project's text.

## Commands

```bash
pnpm test -- template                  # render tests + ts end-to-end (criteria 1, 2, 4–10)
pnpm test:e2e:nextjs                   # create-next-app + overlay end-to-end (criterion 3; network, separate CI job)
```

## Project Structure

```
templates/
├── base/                   → files above; *.tmpl files get placeholder substitution
├── ts/
├── nextjs/
├── release/
└── package/                → package.json partials per layer (deep-merged)
src/utils/template/           → shared (used by the doctor and scaffold modules), pure functions only
├── render.ts               → renderTemplate
├── package-json.ts         → mergePackageJson
├── derive-options.ts       → deriveTemplateOptions
├── agents-md.ts            → builds AGENTS.md, inserts or updates marked blocks without touching other text
├── ownership.ts
└── *.spec.ts
tests/e2e/                  → ts and nextjs end-to-end projects in temp dirs
```

## Code Style

Follows the standards. The marked-block helper is the one piece of logic `cli-doctor` reuses, so it stays small and pure:

```ts
/** Replaces the text between a BEGIN/END marker pair, or appends the block when absent; text outside markers is untouched. */
export const upsertMarkedBlock = (document: string, blockId: string, body: string): string => { … };
```

## Testing Strategy

- **Unit:** render output per option combination (file list plus selected contents), the package.json merge, and the marked-block upsert (insert, replace, leave other blocks alone, idempotent).
- **End-to-end `ts`:** render into a temp dir, `pnpm install` against the locally packed blueprint tarball, run all five commands (criterion 2). Runs in the normal CI job.
- **End-to-end `nextjs`:** create-next-app (pinned major), overlay, five commands (criterion 3). A separate CI job runs it on PRs that touch `templates/` or `presets/`, and weekly.
- **Settings check:** a test parses `.claude/settings.json` and asserts the allow, ask and deny lists (criterion 8). The cloud-only install is tested by running the hook script with and without `CLAUDE_CODE_REMOTE=true`.

## Boundaries

- **Always:**
  - Keep generated projects passing their own standards and CI on the first run.
  - Use the marked-block pattern for any text blueprint manages inside a project-owned file.
  - Update `ownership` when adding a file.
- **Ask first:**
  - Adding or removing a file from any layer.
  - Adding a default dependency.
  - Changing the Claude permission lists.
- **Never:**
  - Edit Next.js's managed block.
  - Put CI logic in caller files.
  - Make a project-owned file depend on being regenerated.

## Success Criteria

- Acceptance criteria 1–9 pass.
- A fresh `ts` project contains exactly the files listed in this spec plus `pnpm-lock.yaml` (about 32 files outside `node_modules` and `.git`). A fresh `nextjs` project contains only what create-next-app creates plus the overlay.
- An agent opening a fresh project finds the commands, standards pointers and "Done means" in `AGENTS.md` without opening any other file first.

## Resolved Questions

1. **Auto-format hook:** yes. A PostToolUse hook formats each edited file.
2. **Starter example:** yes, `src/config/env.ts` with its spec.
3. **Next.js agent files:** keep Next's managed AGENTS.md block and the `@AGENTS.md` CLAUDE.md.
