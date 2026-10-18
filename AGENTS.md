# blueprint

Sets up an agent-first SDLC and CI/CD environment for new TypeScript projects: a CLI (`new`, `doctor`) plus
shared configs and CI, published as `@stavkamil/blueprint`.

## Commands

Scripts live in `package.json`. Before every commit: `pnpm lint && pnpm typecheck && pnpm test`.
`pnpm smoke` proves the packed package installs and runs.

## Where work is defined

- **Building or changing a module** → read its spec in `docs/specs/` (the index is `docs/specs/CAPABILITY-MAP.md`)
  and the task list in its PR description. Update the spec first when a decision changes.

## Standards

Blueprint follows the standards it ships (a ts project):

- **Writing TypeScript** → read standards/typescript.md
- **Writing tests** → read standards/testing.md
- **Adding files or folders** → read standards/structure.md (here, `src/lib/` holds system clients such as `gh`)
- **Opening a PR** → read standards/workflow.md
- **Changing a guide** → keep `tests/standards.spec.ts` green; it guards length, examples and rule placement

Everything else is enforced: run `pnpm lint`.

## Boundaries

- **Ask first:**
  - adding a dependency
  - editing `.github/`
  - changing publish fields in `package.json` (`name`, `bin`, `files`, `exports`, `publishConfig`)
  - changing the ruleset, npm settings or the TypeScript pin
- **Keep the bar:** get to green by fixing the code; coverage thresholds, tests and lint rules stay as they are.
- **Changes reach `main` through a reviewed PR.** Releases come from CI, except the npm publish step, which is
  manual until npm/cli#9969 is fixed (see `docs/maintainer-setup.md`).
- **Never:**
  - commit secrets, tokens or `.npmrc` credentials
  - push to `main`
  - edit `dist/`

## Done means

- `pnpm lint && pnpm typecheck && pnpm test` pass, with coverage ≥ 80%
- Every new or changed export has JSDoc saying why it exists
- Every new piece of logic has a `.spec.ts` that tests its behavior
- The PR title is a Conventional Commit, and the PR template's Testing, Risk and How-to-revert sections are filled in
