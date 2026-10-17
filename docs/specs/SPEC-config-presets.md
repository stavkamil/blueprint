# Spec: config-presets

Module 3 of 8 in [CAPABILITY-MAP.md](CAPABILITY-MAP.md). Depends on `repo-foundation` and `standards`.

## Objective

Ship the shared quality settings every blueprint project extends: ESLint, TypeScript, Prettier and lefthook.
The ESLint configs implement the **entire lint catalog** in [SPEC-standards.md](SPEC-standards.md#lint-catalog-handed-to-config-presets).
Projects keep tiny config files that point at the package. One change in blueprint reaches every project through the
normal weekly Dependabot PR, with no file syncing.

**Users:** projects created by `blueprint new` (`ts` and `nextjs`), and blueprint itself, which uses its own presets.

**Scope:**

- the preset files and how the package exposes them
- the plugin wiring, including file-pattern overrides
- the versioning rule
- fixture tests: one case per lint-catalog rule

**Out of scope:**

- the standards content (`standards`)
- agent instruction files (`project-template`), since agents load those before `node_modules` exists
- each project's own Vitest config and coverage thresholds, its `paths` alias and its `eslint.config.js` (all `project-template`)

### Acceptance criteria

1. **Every lint-catalog rule has a fixture case.** A bad file fails with exactly that rule's ESLint rule ID (or, for compiler-enforced rules, its TypeScript error code), and the matching clean file passes. A test maps catalog lines to fixture files, so a catalog rule without a case fails the suite.
2. **The `ts` fixture** (configs only reference the package) passes `eslint`, `tsc --noEmit`, `prettier --check` and `lefthook validate`.
3. **The `nextjs` fixture** composes `eslint-config-next/core-web-vitals` with the blueprint `nextjs` preset and lints with no "Cannot redefine plugin" error and no duplicate or conflicting rules. It is lint-only, with no Next build.
4. **File-pattern overrides work:**
   - Next.js route files and tool config files may use default exports.
   - `constants.ts`, `src/config/**` and spec files may use numeric literals.
   - Spec files and Next.js route files don't need JSDoc.
   - `app/` folders accept the App Router naming (`[id]`, `(group)`, `@slot`, `_private`).
5. **`tsconfig` resolves:** `extends: "@stavkamil/blueprint/tsconfig/<name>.json"` works with or without TypeScript reading `exports`, because the files sit at those real paths.
6. **No lint plugins to install:** projects install the tools themselves (`eslint`, `prettier`, `typescript`, `lefthook`, plus their test tools, listed in project-template) but **no ESLint plugins**. Every plugin comes from blueprint's dependencies, except `eslint-config-next` in nextjs.
7. **lefthook pre-commit** with one staged `.ts` file finishes in under 5 seconds on the fixture. It fails on a staged fake secret, with a fix message. It fails with `brew install gitleaks` (or "run the cloud setup script") when gitleaks is missing.
8. **Blueprint lints itself** with the `ts` preset and passes.
9. **The standards' examples pass the presets** (the second half of SPEC-standards criterion 3): every `ts`/`tsx` block in `standards/*.md` is linted with the matching preset at its titled path, and the `tsx` blocks typecheck inside the nextjs fixture.

## Tech Stack

- **ESLint 9+ flat config.** `eslint` is a peer dependency. Blueprint's own **dependencies**:
  - `@eslint/js`, `typescript-eslint`, `eslint-config-prettier`
  - `eslint-plugin-barrel-files`, `eslint-plugin-check-file`, `eslint-plugin-jsdoc`, `eslint-plugin-simple-import-sort`, `eslint-plugin-boundaries`
  - `@vitest/eslint-plugin`, `eslint-plugin-testing-library`
- **Plugins provided by the project in nextjs:** `eslint-config-next` registers `react`, `react-hooks`, `jsx-a11y` and `@next/next`. It's an optional peer dependency of blueprint.
- **TypeScript 6.x** (peer `^6`), with JSON tsconfig bases. TypeScript 7 is unsupported until typescript-eslint supports it (planned blueprint v2).
- **Dev-only, for the nextjs fixture:** `eslint-config-next` as a blueprint **devDependency**, so the fixture and the standards' React examples can be linted.
- **Prettier 3** (peer), with a shareable config module.
- **lefthook** (peer), with a YAML base that projects pull in via `extends`.
- **gitleaks:** a system binary (Homebrew locally, the setup script in the cloud).

## What the package exposes

| Import or path                                                         | What it is                                                                                                      | How a project uses it                                                                                     |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `@stavkamil/blueprint/eslint` → `ts`                                   | Full flat config for `ts` projects: `base` + `tests` + `boundaries("ts")`                                       | `export default [...ts]`                                                                                  |
| `@stavkamil/blueprint/eslint` → `nextjs`                               | Full flat config for `nextjs` projects: `base` + `react` + `tests` + `boundaries("nextjs")` + Next.js overrides | `export default [...nextCoreWebVitals, ...nextjs]` (Next's config **first**, so it registers its plugins) |
| `@stavkamil/blueprint/eslint` → `base`, `react`, `tests`, `boundaries` | The building blocks, for advanced composition                                                                   | Not used by templates                                                                                     |
| `@stavkamil/blueprint/prettier`                                        | Prettier config object                                                                                          | `package.json`: `"prettier": "@stavkamil/blueprint/prettier"`                                             |
| `@stavkamil/blueprint/tsconfig/node.json`                              | For `ts` projects                                                                                               | `tsconfig.json` `extends`                                                                                 |
| `@stavkamil/blueprint/tsconfig/nextjs.json`                            | For `nextjs` projects                                                                                           | `tsconfig.json` `extends`                                                                                 |
| `node_modules/@stavkamil/blueprint/presets/lefthook/base.yml`          | Git hooks                                                                                                       | `lefthook.yml` `extends`                                                                                  |

**Plugin registration (prevents "Cannot redefine plugin"):**

- `base`, `tests` and `boundaries` register their own plugins.
- `react` registers **nothing**. It only sets rules for the `react`, `react-hooks` and `jsx-a11y` plugins that `eslint-config-next` registered.
- `testing-library` is registered by `tests` (Next's config doesn't include it).
- nextjs projects use `eslint-config-next/core-web-vitals` only, **not** `eslint-config-next/typescript`, because blueprint's `base` already provides typescript-eslint.

## Rule wiring

The catalog in SPEC-standards.md is the source of truth for _which_ standards exist. This section lists only the
wiring details the catalog leaves open.

**`base`** (all `*.ts`, `*.tsx`, `*.js` files)

- `@eslint/js` recommended + `typescript-eslint` `recommendedTypeChecked` with `projectService: true`
- Every TypeScript and module rule from the catalog
- Settings the catalog leaves open:
  - `@typescript-eslint/naming-convention`:
    - `variable`: `strictCamelCase` or `StrictPascalCase` (components and const objects); `_` allowed as a leading character for unused names
    - `variable` with `types: ["boolean"]`: prefix `is`/`has`/`should`/`can` (uses type info)
    - `typeLike`: `StrictPascalCase`
    - `function`/`parameter`: `strictCamelCase`
  - `@typescript-eslint/no-magic-numbers`: ignore `-1, 0, 1`; `ignoreArrayIndexes`, `ignoreDefaultValues`, `ignoreTypeIndexes`, `ignoreReadonlyClassProperties`
  - `@typescript-eslint/explicit-module-boundary-types`: on for `*.ts`, **off for `*.tsx`**, since a component always returns JSX and requiring the type adds noise
  - `check-file`: kebab-case file names under `src/**`; kebab-case folder names, with `app/**` using check-file's Next.js App Router pattern
  - `no-restricted-syntax` entries:
    - `ExportDefaultDeclaration` ("use a named export")
    - `TSUnionType > TSLiteralType` ("define a const object and derive the type")
    - `.then()` member calls ("use async/await")
  - `no-restricted-imports`: block `../../*` ("use the `@/` alias") **in nextjs only**. See Resolved Questions 3.
- `eslint-config-prettier` last

**Overrides (by file pattern)**

- Next.js route files (`app/**/{page,layout,loading,error,not-found,route,template,default}.tsx`) and `*.config.{js,ts,mjs}`: default export allowed; JSDoc not required
- `**/constants.ts`, `src/config/**`, `**/*.spec.{ts,tsx}`: magic numbers allowed
- `**/*.spec.{ts,tsx}`: JSDoc not required; `@typescript-eslint/no-non-null-assertion` stays on

**`react`** (nextjs, `*.tsx`; rules only)

- `react-hooks` recommended, including the React Compiler rules
- `react/no-multi-comp`, `react/destructuring-assignment: always`
- `react/function-component-definition: arrow-function`
- `react/jsx-handler-names`
- `jsx-a11y` recommended
- `@typescript-eslint/no-restricted-types` blocks `React.FC` and `FC`

**`tests`** (`*.spec.ts`, `*.spec.tsx`)

- `@vitest/eslint-plugin` recommended + `consistent-test-filename` (`.spec`), `no-focused-tests`, `no-disabled-tests`
- `eslint-plugin-testing-library` react config, only on `*.spec.tsx`

**`boundaries("ts" | "nextjs")`**

- **Element types:**
  - nextjs: `app`, `feature` (`src/features/*`), and shared `components`, `hooks`, `utils`, `types`, `config`, `lib`
  - ts: `entry` (`src/index.ts` and `src/commands/**`), `module` (`src/modules/*`), and shared `utils`, `types`, `config`, `lib`
- **Allowed imports:**
  - a feature or module imports itself and shared folders
  - shared folders import shared folders only
  - `app` and `entry` import features or modules and shared folders
- Error messages name the allowed targets ("`features/cart` can import from shared folders or itself; move shared code to `src/utils`")

## Preset contents (non-ESLint)

**tsconfig `node.json`:**

- `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`
- `verbatimModuleSyntax`, `erasableSyntaxOnly`, `rewriteRelativeImportExtensions`, `isolatedModules`, `skipLibCheck`
- `target: ES2024`, `module: nodenext`, `declaration`, `sourceMap`
- `types: ["node"]` (TS 6 no longer includes `@types/*` by default). `rootDir` isn't set here, because TypeScript resolves it relative to this file in `node_modules`. Each project's `tsconfig.build.json` sets `rootDir: "src"`, so output lands in `dist/` rather than `dist/src/` (project-template).

**tsconfig `nextjs.json`:**

- The same strictness flags, **including `erasableSyntaxOnly`** (it enforces "no enum"; Next's compiler doesn't need the erasable-only features it forbids)
- `module: esnext`, `moduleResolution: bundler`, `jsx: preserve`, `noEmit`, `allowJs`, `incremental`, `plugins: [{ "name": "next" }]`
- No `rewriteRelativeImportExtensions` (nextjs imports omit extensions)
- **No `paths` here.** TypeScript resolves `paths` relative to the file that declares them, which would point into `node_modules`. The `@/*` alias goes in the project's own `tsconfig.json` (`project-template`).

**Prettier:** Prettier's defaults, plus `printWidth: 100`.

**lefthook `base.yml`:**

- `pre-commit` (run in parallel):
  - Prettier `--write` on staged files (`stage_fixed: true`)
  - ESLint `--fix` on staged `.ts`/`.tsx`/`.js` files (`stage_fixed: true`)
  - `gitleaks git --pre-commit --staged --redact`. If `gitleaks` is missing, the hook fails with the install command
- `pre-push`: `pnpm typecheck && pnpm test`

## Versioning rule (keeps Dependabot PRs green)

- **Patch and minor releases must never make a passing project fail.** They can fix bugs, relax rules, or add settings that don't produce new errors.
- **Any change that can produce new errors is a major release:** a new error-level rule, a stricter compiler flag, a new hook check. Dependabot sends majors as separate PRs, and the release notes say what to fix.
- The fixture tests run on every PR. A change that breaks a clean fixture must be labeled as breaking (`feat!:`).

## Commands

```bash
pnpm test                      # includes all fixture tests
pnpm test -- presets           # only preset tests
pnpm exec eslint --print-config tests/fixtures/ts-sample/src/index.ts   # inspect resolved rules
```

## Project Structure

```
presets/
├── eslint/
│   ├── index.js               → exports ts, nextjs, base, react, tests, boundaries
│   ├── base.js
│   ├── react.js
│   ├── tests.js
│   └── boundaries.js
├── prettier/index.js
└── lefthook/base.yml
tsconfig/                      → at the package root so the real path matches the import path
├── node.json
└── nextjs.json
tests/
├── fixtures/
│   ├── ts-sample/             → clean project + one bad file per catalog rule
│   └── nextjs-sample/         → eslint-config-next + nextjs preset (lint only)
├── catalog-map.ts             → catalog line → fixture file + expected rule ID
└── presets.spec.ts            → runs eslint, tsc, prettier, lefthook against fixtures
```

## Code Style

Preset modules are plain ESM JavaScript with JSDoc types, so projects load them without a build step. They follow the
standards themselves (arrow functions, named exports, JSDoc on exports).

```js
// presets/eslint/index.js
import { base } from "./base.js";
import { boundaries } from "./boundaries.js";
import { react } from "./react.js";
import { tests } from "./tests.js";

/** Complete config for `ts` projects: one import gives the whole standard. */
export const ts = [...base, ...tests, ...boundaries("ts")];

/** Complete config for `nextjs` projects; spread it after eslint-config-next, which registers the React plugins. */
export const nextjs = [...base, ...react, ...tests, ...boundaries("nextjs")];

export { base, boundaries, react, tests };
```

All other conventions follow [SPEC-repo-foundation.md](SPEC-repo-foundation.md#code-style) and the standards.

## Testing Strategy

- **Catalog coverage:** `catalog-map.ts` lists every catalog line with its fixture file and expected rule ID. The suite fails if a catalog line has no entry, a bad file passes, or a clean file fails (criterion 1).
- **Fixture runs:** Vitest runs the real tools as child processes against `tests/fixtures/*` and checks exit codes and rule IDs.
- **Speed check:** a test times lefthook pre-commit with one staged file and fails above 5 seconds. It's skipped if gitleaks is missing locally; CI installs it.
- **Self-use:** blueprint's own lint, typecheck and format run through the `ts` preset (criterion 8).

## Boundaries

- **Always:**
  - Add a fixture case and a `catalog-map.ts` entry for every rule you add or change.
  - Follow the versioning rule.
  - Keep presets as plain JS or JSON that loads without a build.
  - Write error messages that name the allowed alternative.
- **Ask first:**
  - Adding a rule, plugin or compiler flag that isn't in the standards catalog.
  - Making a breaking change.
- **Never:**
  - Register a plugin that `eslint-config-next` already registers.
  - Ship a rule change that breaks a clean fixture in a minor or patch release.
  - Add formatting rules to ESLint.
  - Put agent instruction files in the package.

## Success Criteria

- Acceptance criteria 1–9 pass in CI.
- A sample project's config files that extend presets are each 1–10 lines, with no copied rule lists.
- Bumping `@stavkamil/blueprint` by a patch or minor version in the fixtures changes no lint, typecheck or format results.

## Resolved Questions

1. **Strictness:** typescript-eslint `recommendedTypeChecked` plus the standards catalog (the earlier default).
2. **gitleaks missing locally:** block the commit with the install command (the earlier default).
3. **`@/` alias:** `nextjs` only. `ts` projects use relative imports, because `tsc` doesn't rewrite aliases. The boundaries rule enforces structure in both.
4. **Explicit return types:** required on exported functions in `.ts` files, off in `.tsx` files.
5. **TypeScript version:** 6.x. TypeScript 7's native compiler has no programmatic API yet, so typescript-eslint can't run on it.
