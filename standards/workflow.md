# Opening a PR

Follow the steps in order. Each one ends with the check that tells you it's done.

1. **Branch from `main` with one change per branch.** _Done when:_ the diff touches one feature or concern, and its title fits in one line.
2. **Run the checks locally:** `pnpm lint && pnpm typecheck && pnpm test`. _Done when:_ all three exit 0.
3. **Title the PR as a Conventional Commit**: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `ci:`, with `!` for a breaking change. _Done when:_ the PR-title check passes.
4. **Fill in the PR template**: Summary, Testing (commands run and their result), Risk, How to revert, and the agent session link if one exists. _Done when:_ the Testing, Risk and How to revert sections each have real content.
5. **Answer every review finding**: fix it, or resolve the thread with a written reason. _Done when:_ every thread is resolved and `ci-ok` is green.

The PR title becomes the commit message on `main` and drives the version number, so a precise title is worth the
extra minute.

Source: [Conventional Commits](https://www.conventionalcommits.org/)
