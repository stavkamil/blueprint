# blueprint

Sets up an agent-first SDLC and CI/CD environment for new TypeScript projects: a CLI (`new`, `doctor`) plus
shared configs and CI, published as `@stavkamil/blueprint`.

## Commands

Scripts live in `package.json`. Before every commit: `pnpm lint && pnpm typecheck && pnpm test`.
`pnpm smoke` proves the packed package installs and runs.

## Where work is defined

- **Building or changing a module** → read its spec in `docs/specs/` (the index is `docs/specs/CAPABILITY-MAP.md`)
  and its task list in `tasks/`. Update the spec first when a decision changes.

## Layout

- `src/index.ts` is the bin entry; `src/commands/` composes modules, one file per command.
- `src/modules/<name>/` holds one domain each; modules import only themselves and shared folders.
- Shared code: `src/utils/` (pure helpers), `src/lib/` (system clients such as `gh` and the Keychain).
- Tests sit next to the code as `*.spec.ts`.

## Boundaries

- **Ask first:**
  - adding a dependency
  - editing `.github/`
  - changing publish fields in `package.json` (`name`, `bin`, `files`, `exports`, `publishConfig`)
  - changing the ruleset, npm settings or the TypeScript pin
- **Keep the bar:** get to green by fixing the code; coverage thresholds, tests and lint rules stay as they are.
- **Releases come only from CI.** Changes reach `main` through a reviewed PR.
- **Never:**
  - commit secrets, tokens or `.npmrc` credentials
  - push to `main`
  - edit `dist/`

## Done means

- `pnpm lint && pnpm typecheck && pnpm test` pass, with coverage ≥ 80%
- Every new or changed export has JSDoc saying why it exists
- Every new piece of logic has a `.spec.ts` that tests its behavior
- The PR title is a Conventional Commit, and the PR template's Testing, Risk and How-to-revert sections are filled in
