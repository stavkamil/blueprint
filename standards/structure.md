# Adding files or folders

Where new code goes. Lint enforces the import boundaries described here; this guide says where to put things so they
pass.

## Layout

A **nextjs** project:

```text
src/
├── app/                 routes only: each page or layout stays thin and calls into a feature
├── features/<name>/     one folder per feature: its components, hooks, data access, types and tests
├── components/          UI used by two or more features
├── hooks/               hooks used by two or more features
├── utils/               pure helper functions
├── types/               types used by two or more features
├── config/              shared constants and the validated environment (env.ts)
└── lib/                 preconfigured third-party clients (database, auth, analytics)
```

A **ts** project (library, CLI or service):

```text
src/
├── index.ts             the entry point: exports the library, or starts the CLI or server
├── commands/            CLIs only: one file per command, composing modules
├── modules/<name>/      one folder per domain area: its code, types and tests
├── utils/  types/  config/  lib/     same meaning as above
```

So a new feature starts as `src/features/<name>/` (nextjs) or `src/modules/<name>/` (ts).

Source: [Bulletproof React, project structure](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md)

## Feature boundaries

Features (and modules) never import each other. When two of them need the same code, move it to a shared folder.
When a flow uses several features, compose them in an entry point: a route in `app/`, or `src/index.ts` /
`src/commands/` in a ts project.

## Where a new file starts

Colocate first: code, types, constants and tests start inside the feature that uses them. Move something to a shared
folder only when a second feature needs it, and move it in the same change that adds the second use.

## When a feature grows

Keep a feature's folder flat until it holds about 7 files. Then group them into subfolders by role: `components/`,
`hooks/`, `api/` and `testing/` (shared test data).
