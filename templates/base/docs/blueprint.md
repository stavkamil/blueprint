# Blueprint

This project was created with [blueprint](https://github.com/stavkamil/blueprint) v{{blueprintVersion}}. The project
owns its files; blueprint keeps a few of them current.

## What blueprint owns

- `docs/standards/` and this file
- the `blueprint-standards` block in `AGENTS.md`

`pnpm exec blueprint doctor --fix` replaces them with the installed version's copy. Change everything else freely.

## How updates arrive

- **Lint, TypeScript, Prettier and git hook presets:** the `@stavkamil/blueprint` dev dependency. Dependabot proposes
  new versions.
- **CI:** `.github/workflows/` call blueprint's shared workflows at `@v{{blueprintMajor}}`, which follows every
  v{{blueprintMajor}}.x release.
- **Standards and the `AGENTS.md` block:** `pnpm exec blueprint doctor --fix`.
