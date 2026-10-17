## Standards

- **Writing TypeScript** → read docs/standards/typescript.md
- **Writing React components** → read docs/standards/react.md <!-- nextjs-only -->
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
