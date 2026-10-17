# Spec: standards

Module 2 of 8 in [CAPABILITY-MAP.md](CAPABILITY-MAP.md). Depends on `repo-foundation`. `config-presets` and `project-template` depend on it.

## Objective

Define one set of coding standards that every blueprint project follows, whichever agent (or human) writes the code.
Standards reach code in two ways:

1. **Checkable rules → ESLint** (implemented by `config-presets`). These are enforced every time, for every agent.
2. **Judgment rules → short Markdown guides** in `docs/standards/`, linked from each project's `AGENTS.md` with one pointer line per situation.

The guides follow the [writing-for-agents](https://github.com/mattpocock/skills/blob/main/skills/productivity/writing-for-agents/SKILL.md) principles:

- They state target behavior, and examples show only correct code.
- They contain only what lint can't check, plus the reason where it matters.
- Each rule lives in exactly one place.
- Terms are used consistently.
- Every step has a checkable completion criterion.

They build on established sources rather than inventing rules:

- [typescript-eslint](https://typescript-eslint.io/)
- [Rules of React](https://react.dev/reference/rules) and [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
- [Testing Library guiding principles](https://testing-library.com/docs/guiding-principles)
- [Bulletproof React](https://github.com/alan2207/bulletproof-react)

**Users:** coding agents (Claude Code, Codex, Cursor, Copilot and others that read `AGENTS.md`), human contributors, and the AI reviewer (via `REVIEW.md`).

### Acceptance criteria

1. Blueprint ships `standards/{typescript,react,testing,structure,workflow}.md`, copied into projects as `docs/standards/`.
2. Each guide is under 100 lines, with no negative examples. The only prohibitions are the guardrails listed in this spec, each paired with what to do instead.
3. **Examples pass the standards,** checked in two stages:
   - **Here (done):** every `ts`/`tsx` code block in the guides declares the path it would live at (` ```ts title="src/features/cart/get-cart-total.ts" `). Every `ts` block typechecks under blueprint's strict tsconfig (`tests/standards.spec.ts`).
   - **In `config-presets`:** every block is linted with the real presets at its path, and the `tsx` (React) blocks typecheck in the nextjs fixture, which brings React's types. Neither can run before the presets and fixtures exist.
4. **The AGENTS.md standards block** (pointers + "Done means") is defined here, word for word, in `standards/agents-block.md`. `project-template` inserts it between markers, and `doctor --fix` keeps it current.
5. **Every lint-catalog rule is enforced and tested.** Each rule below maps to a named ESLint rule ID or a TypeScript compiler check (for example `erasableSyntaxOnly`), and to a fixture case in `config-presets` (owned and tested there, through its `catalog-map.ts`). No rule from the catalog is repeated in a guide; `tests/standards.spec.ts` checks the most common restatements.
6. Every rule in the **guide catalog** appears in exactly one guide.
7. A manual agent check passes before v1 ships, **run after `project-template` exists** (it needs a generated project). An agent (Claude Code in a fixture project) completes three tasks: add a feature with a component, add a utility with tests, and fix a bug. Its output passes lint, typecheck and tests, and a reviewer checking the guide catalog finds no violations.

## Lint catalog (handed to `config-presets`)

Each line: the standard → the rule that enforces it. Applies to `ts` and `nextjs` unless marked.

**TypeScript and modules**

- Named exports only; default exports only in files Next.js requires them in (`page`, `layout`, `loading`, `error`, `not-found`, `route`, `template`, `default`) and in tool config files → `no-restricted-syntax` on `ExportDefaultDeclaration`, with file overrides
- Import directly from the source file; no barrel files → `eslint-plugin-barrel-files`
- Files and folders in kebab-case → `eslint-plugin-check-file`
- `type` for object types (`consistent-type-definitions: type`); use intersections to extend → `@typescript-eslint/consistent-type-definitions`
- Fixed value sets as const objects; no hand-written literal unions → `no-restricted-syntax` on `TSUnionType > TSLiteralType`
- No `enum` → tsconfig `erasableSyntaxOnly`, in both tsconfig presets (compiler error TS1294)
- No `any`, no `!` non-null assertions → `@typescript-eslint/no-explicit-any`, `@typescript-eslint/no-non-null-assertion`
- Explicit return types on exported functions in `.ts` files (not `.tsx` components) → `@typescript-eslint/explicit-module-boundary-types`
- Arrow functions only (components included) → `func-style: expression`, `prefer-arrow-callback`, `react/function-component-definition` (nextjs)
- Naming → `@typescript-eslint/naming-convention`:
  - variables camelCase or PascalCase (PascalCase is for components and const objects)
  - types PascalCase
  - boolean variables start with `is`/`has`/`should`/`can`
  - abbreviations as words (`userId`), via `strictCamelCase` / `StrictPascalCase`

  _Which_ names must be PascalCase (const objects) is in the guide, since the rule can't tell an `as const` object from other values.

- No magic numbers (allows -1, 0, 1, array indexes, default values; exempt in `constants.ts`, `src/config/**` and `*.spec.ts`) → `@typescript-eslint/no-magic-numbers`
- Throw only `Error` objects → `@typescript-eslint/only-throw-error`
- `async`/`await` instead of `.then()` → `no-restricted-syntax` on `.then` calls
- Never reassign parameters or mutate their properties → `no-param-reassign` with `props: true`
- `console.warn`/`console.error` only → `no-console`
- JSDoc on every export, with a description and no type tags → `eslint-plugin-jsdoc` (`require-jsdoc` publicOnly, `require-description`, `no-types`)
- Import order sorted automatically → `eslint-plugin-simple-import-sort`
- Feature boundaries → `eslint-plugin-boundaries`:
  - a feature (nextjs) or module (ts) imports only its own files and shared folders
  - shared folders never import features or modules
  - entry points compose them: `app/` in nextjs; `src/index.ts` and `src/commands/**` in ts
- `@/` alias for cross-folder imports, relative imports only inside a feature (nextjs; `ts` projects use relative imports because `tsc` doesn't rewrite aliases) → `no-restricted-imports` on `../../*`

**React** (nextjs)

- Rules of React and hooks, including the React Compiler checks → `eslint-plugin-react-hooks` recommended
- One component per file → `react/no-multi-comp`
- Props destructured in the signature; no `React.FC` → `react/destructuring-assignment`, `@typescript-eslint/no-restricted-types`
- Handler naming `on*` props / `handle*` functions → `react/jsx-handler-names`
- Accessibility → `eslint-plugin-jsx-a11y` recommended

**Tests**

- Test files named `*.spec.ts`/`*.spec.tsx` → `@vitest/eslint-plugin` `consistent-test-filename`
- No focused or skipped tests left in → `@vitest/eslint-plugin` `no-focused-tests`, `no-disabled-tests`
- Vitest recommended rules → `@vitest/eslint-plugin` recommended
- Testing Library usage (nextjs) → `eslint-plugin-testing-library` react config

**Coverage** (set in each project's Vitest config by `project-template`): 80% of lines, enforced in `pnpm test`. Excluded: Next.js route files, config files, type-only files, generated code, `*.spec.*`.

**Constraint for `config-presets`:** `eslint-config-next` already registers the `react`, `react-hooks`, `jsx-a11y` and `@next/next` plugins.
The React layer must configure those plugins' rules without registering them again, or ESLint fails with "Cannot redefine plugin".

## Guide catalog (the content of `docs/standards/`)

**`typescript.md`**: writing TypeScript

- Domain values: a PascalCase const object + type derived from its values (`(typeof X)[keyof typeof X]`), same name for both, so API and database values match without mapping
- Validate outside data with Zod at the boundary: env vars in `src/config/env.ts`, request bodies, form input, third-party responses. Derive types with `z.infer`; trust data inside the boundary
- Errors: throw `Error` subclasses named for the failure (`CartEmptyError`). Catch only to handle or to rethrow with added context (`cause`)
- One main export per file, plus its own types and constants. Helpers used only in that file stay unexported
- JSDoc says what the export is for and why, plus anything surprising; `@param` only for parameters whose meaning isn't obvious from name and type
- Comments explain why. Every TODO links an issue
- Strings with meaning (statuses, keys, routes) live as constants, colocated by the same rule as types (see `structure.md`)

**`react.md`**: writing React components (nextjs)

- Server components by default; add `"use client"` only to the smallest interactive leaf
- State ladder: component state → URL search params → a global store only after the first two fail, recorded in an ADR
- Derive values during render, fetch data in server components, and keep `useEffect` for syncing with outside systems
- Composition with `children` over long prop lists. Props type named `<Component>Props`
- Semantic HTML first (a `<button>` for actions, `<a>` for navigation, a label for every input). Style with Tailwind classes

**`testing.md`**: writing tests

- Colocate: `cart.ts` → `cart.spec.ts` in the same folder
- Test names describe behavior: `it("rejects checkout when the cart is empty")`. Arrange / Act / Assert, separated by blank lines
- Mock only at the edges (network, time, randomness); use real modules everywhere else
- Components: query by role, label, then text, the way users find things; interact with `user-event`
- Test data comes from small factories (`makeCart({ items: [] })`) in the spec file or the feature's `testing/` folder
- Snapshots only for small, stable output
- Network fakes: add MSW when a feature calls an external API. Browser tests: add Playwright for critical user flows when the project has them. Neither is installed by default
- Coverage: 80% of lines (what counts is listed in the lint catalog)

**`structure.md`**: adding files or folders

- Layout per project type:
  - nextjs: `src/app` (routes only, thin), `src/features/<name>`, shared `components/`, `hooks/`, `utils/`, `types/`, `config/`, `lib/`
  - ts: `src/index.ts` (entry), `src/commands/` (CLIs: one file per command, composing modules), `src/modules/<name>`, shared `utils/`, `types/`, `config/`, `lib/`
- Modules and features never import each other. Code two of them need moves to a shared folder; flows that use several modules live in an entry point (`app/`, `src/index.ts`, `src/commands/`)
- What each shared folder is for: `utils` = pure helpers, `types` = types used by 2+ features, `config` = shared constants and validated env, `lib` = preconfigured third-party clients
- Colocate: code, types, constants and tests start inside the feature that uses them, and move to a shared folder once a second feature needs them
- A feature stays flat until about 7 files, then groups into `components/`, `hooks/`, `api/`, `testing/`

**`workflow.md`**: opening a PR (steps, each with a completion criterion)

1. Branch from `main`, one change per branch. _Done when:_ the diff touches one feature or concern.
2. Run `pnpm lint && pnpm typecheck && pnpm test`. _Done when:_ all three exit 0.
3. Title the PR as a Conventional Commit (`feat:`, `fix:`, `chore:`…). _Done when:_ the PR-title check passes.
4. Fill in the PR template. _Done when:_ the Testing, Risk and How-to-revert sections each have content.
5. Address review findings. _Done when:_ every thread is fixed or resolved with a written reason.

## AGENTS.md standards block (inserted verbatim by `project-template`)

```md
## Standards

- **Writing TypeScript** → read docs/standards/typescript.md
- **Writing React components** → read docs/standards/react.md
- **Writing tests** → read docs/standards/testing.md
- **Adding files or folders** → read docs/standards/structure.md
- **Opening a PR** → read docs/standards/workflow.md
- **Reviewing a PR** → read REVIEW.md, then judge against docs/standards/

Everything else is enforced: run `pnpm lint`.

## Done means

- `pnpm lint && pnpm typecheck && pnpm test` pass, with coverage ≥ 80%
- Every new or changed export has JSDoc saying why it exists
- Every new piece of logic has a `.spec.ts` that tests its behavior
- The PR template's Testing, Risk and How-to-revert sections are filled in
```

In `agents-block.md` the React line ends with `<!-- nextjs-only -->`, and the renderer drops it for `ts` projects. That keeps one source file for both variants.

## Tech Stack

- Markdown guides (no build step), shipped in the npm package under `standards/`
- Example checking: Vitest test that extracts code blocks and runs ESLint + `tsc` against the blueprint presets
- Zod is listed as a default dependency of new projects (added by `project-template`)

## Commands

```bash
pnpm test -- standards        # length, format and example-code checks for the guides
```

## Project Structure

```
standards/
├── typescript.md
├── react.md
├── testing.md
├── structure.md
├── workflow.md
└── agents-block.md          → the AGENTS.md standards block (single source for project-template and doctor; nextjs-only lines marked)
tests/standards.spec.ts      → criteria 2, 3 and 6
```

## Writing style for the guides

- Each section heading is the situation. Its first sentence is the target behavior. One ✅ example follows only when it adds clarity. Then one line of _why_ if the reason isn't obvious.
- Established terms are used consistently: _colocate_, _feature boundary_, _Arrange / Act / Assert_, _test behavior_, _server component_, _state ladder_.
- Prohibitions appear only as guardrails with no positive phrasing, and always name the alternative.
- The guides never restate scripts, config or folder trees that an agent can see in the repo, except the layout in `structure.md`, which defines where _new_ things go.

## Testing Strategy

- **Automated:** `tests/standards.spec.ts` checks:
  - guide length (under 100 lines)
  - the five required guides plus `agents-block.md` exist
  - no ❌ markers or negative examples
  - every `ts`/`tsx` block passes ESLint + `tsc` with the presets
  - no guide rule duplicates a lint-catalog rule, via a keyword check against a list maintained in the test
- **Manual before v1:** the agent check in acceptance criterion 7.
- **Pruning pass:** after the first two real projects, remove guide lines that agents follow without the guide.

## Boundaries

- **Always:**
  - Put a rule in lint when a rule exists for it; the guides hold only what lint can't check.
  - Link the source guide when a rule comes from one.
  - Keep each rule in one place.
- **Ask first:**
  - Adding, removing or changing any standard.
  - Adding an ESLint plugin.
  - Adding a guide file or a new pointer line.
- **Never:**
  - Ship negative code examples in a guide.
  - Duplicate a lint rule in a guide.
  - Grow a guide past 100 lines (split it by situation instead).

## Success Criteria

- Acceptance criteria 1–7 pass.
- A new project's `AGENTS.md` is under 60 lines including the standards block.
- In the manual agent check, every judgment-rule violation the reviewer finds leads to a sharper guide line or a new lint rule before v1 ships.

## Resolved Questions

1. **Plugin list:** approved. Blueprint depends on these plugins, so projects install nothing extra:
   - barrel-files, check-file, jsdoc, simple-import-sort, boundaries, @vitest/eslint-plugin, testing-library
   - nextjs projects also use the react, react-hooks and jsx-a11y plugins that come with `eslint-config-next`
2. **`interface` exception:** approved. Lint enforces `type` everywhere. Module augmentation (`declare module`) uses `interface` with a lint-disable comment that gives the reason.
