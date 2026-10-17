# Todo: standards

Plan: [plan.md](plan.md). Spec: [SPEC-standards.md](../docs/specs/SPEC-standards.md).

---

## Task 1: Content test harness, wiring, spec fix

**Description:** Create `tests/standards.spec.ts` with checks that run over a list of required guides (empty at first),
wire `tests/` into Vitest and tsconfig, and fix the mangled AGENTS block in the spec.

**Acceptance criteria:**

- [x] For each guide in the required list, the test checks:
  - the file exists and is under 100 lines
  - no ❌ markers or negative-example headings
  - every `ts`/`tsx` code block has a `title="<path>"`
  - every `ts` block typechecks under blueprint's strict tsconfig in a temp folder
- [x] Rule-placement check: each guide-catalog rule's key phrase appears in exactly its one guide (catalog-to-guide keyword map in the test)
- [x] `vitest.config.ts` and `tsconfig.json` include `tests/`; coverage still measures `src/` only; the spec's AGENTS block shows "Everything else is enforced" as its own line

**Verification:**

- [x] Tests pass: `pnpm test` (the required list is empty, so the guide checks run but find nothing)
- [x] Manual check: putting a fake guide in the list makes the test fail with a clear message, then revert

**Dependencies:** None

**Files likely touched:** `tests/standards.spec.ts`, `tests/support/code-blocks.ts`, `vitest.config.ts`, `tsconfig.json`, `docs/specs/SPEC-standards.md`

**Estimated scope:** M

---

## Task 2: `typescript.md`

**Description:** Write the TypeScript guide from the spec's guide catalog: domain values, Zod at the boundary, errors, one main export, JSDoc content, comments, meaningful strings. Add `zod` as a dev dependency so the examples typecheck.

**Acceptance criteria:**

- [x] Adding `typescript.md` to the required list goes red, and the guide turns it green
- [x] Every catalog rule for this guide is present, with a ✅ example only where it adds clarity and a source link where a rule comes from one
- [x] No rule from the lint catalog is restated

**Verification:**

- [x] Tests pass: `pnpm test`
- [x] Manual check: the guide reads as target behavior and is under 100 lines

**Dependencies:** Task 1

**Files likely touched:** `standards/typescript.md`, `tests/standards.spec.ts`, `package.json`, `pnpm-lock.yaml`

**Estimated scope:** S

---

## Task 3: `testing.md`

**Description:** Write the testing guide: colocation, behavior names, Arrange/Act/Assert, mocking only at the edges, user-centric queries, factories, snapshots, when to add MSW or Playwright, coverage.

**Acceptance criteria:**

- [x] The required-list entry goes red, then the guide turns it green
- [x] Every catalog rule for this guide is present, and its `ts` examples typecheck
- [x] No lint-catalog rule restated (e.g. `.spec.ts` naming is lint's, so it's not repeated)

**Verification:**

- [x] Tests pass: `pnpm test`

**Dependencies:** Task 1

**Files likely touched:** `standards/testing.md`, `tests/standards.spec.ts`

**Estimated scope:** S

---

## Task 4: `structure.md`

**Description:** Write the structure guide: layout per project type (where _new_ things go), the shared folders' purposes, the colocate-then-promote rule, and when a feature splits into subfolders.

**Acceptance criteria:**

- [x] The required-list entry goes red, then the guide turns it green
- [x] Both layouts (nextjs, ts) are described, and the "modules never import each other" rule names where cross-module flows live
- [x] Folder trees appear only to define where new code goes, not to mirror the repo

**Verification:**

- [x] Tests pass: `pnpm test`

**Dependencies:** Task 1

**Files likely touched:** `standards/structure.md`, `tests/standards.spec.ts`

**Estimated scope:** S

---

## Task 5: `workflow.md`

**Description:** Write the PR workflow as ordered steps, each ending in a checkable "Done when".

**Acceptance criteria:**

- [x] The required-list entry goes red, then the guide turns it green
- [x] Five steps (branch, checks, title, template, review findings), each with a "Done when" line (checked by the test)

**Verification:**

- [x] Tests pass: `pnpm test`

**Dependencies:** Task 1

**Files likely touched:** `standards/workflow.md`, `tests/standards.spec.ts`

**Estimated scope:** XS

---

## Task 6: `react.md`

**Description:** Write the React guide: server components first, the state ladder, effects only for outside systems, composition and props naming, semantic HTML and Tailwind.

**Acceptance criteria:**

- [x] The required-list entry goes red, then the guide turns it green
- [x] Every `tsx` example has a path title; typechecking and linting them is recorded as deferred to `config-presets`
- [x] Links to Rules of React and You Might Not Need an Effect where those rules come from

**Verification:**

- [x] Tests pass: `pnpm test`

**Dependencies:** Task 1

**Files likely touched:** `standards/react.md`, `tests/standards.spec.ts`

**Estimated scope:** S

---

## Checkpoint A: guides written

- [x] All five guides pass the content tests
- [x] `pnpm lint && pnpm typecheck && pnpm test` green
- [ ] You review the guides in the PR

---

## Task 7: `agents-block.md` and blueprint's own AGENTS.md

**Description:** Write `standards/agents-block.md` exactly as the spec defines it, with the React line tagged `<!-- nextjs-only -->`. Then point blueprint's own `AGENTS.md` at the guides (at their `standards/` paths in this repo), keeping it under 60 lines.

**Acceptance criteria:**

- [ ] The test checks that `agents-block.md` has one pointer line per guide plus the review line, a separate "Everything else is enforced" line, and the "Done means" list
- [ ] Exactly one line carries `<!-- nextjs-only -->`, and it's the React pointer
- [ ] Blueprint's `AGENTS.md` has a Standards section pointing at the five guides and stays under 60 lines

**Verification:**

- [ ] Tests pass: `pnpm test`
- [ ] Manual check: a fresh agent session in this repo finds the right guide from AGENTS.md alone

**Dependencies:** Tasks 2–6

**Files likely touched:** `standards/agents-block.md`, `AGENTS.md`, `tests/standards.spec.ts`

**Estimated scope:** S

---

## Task 8: Ship `standards/` in the package

**Description:** Add `standards/` to the package's `files`, and make the smoke test require the five guides and `agents-block.md` in the tarball.

**Acceptance criteria:**

- [ ] `pnpm pack --dry-run` lists `standards/*.md`
- [ ] `pnpm smoke` fails if a guide is missing from the tarball (spot-checked, then reverted)

**Verification:**

- [ ] Build succeeds: `pnpm smoke`

**Dependencies:** Task 7

**Files likely touched:** `package.json`, `scripts/smoke.ts`

**Estimated scope:** XS

---

## Checkpoint B: module done (for now)

- [ ] Spec criteria 1, 2, 4 and 6 pass; criterion 3's "now" half passes
- [ ] Spec updated: criterion 3 split, 5 owned by `config-presets`, 7 after `project-template`
- [ ] PR merged; the 1.1.0 release published with the manual npm workaround
