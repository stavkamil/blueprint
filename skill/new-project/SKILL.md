---
name: new-project
description: Create a new project with blueprint's full setup (repo, CI, standards, agent config).
disable-model-invocation: true
---

Create one project with `blueprint new`, which scaffolds, verifies, commits, pushes and secures it. The CLI does the
work; your job is to gather the answers, get approval, run it once, and report what it returned.

Arguments, if any: $ARGUMENTS

## 1. Gather

Take every value the arguments already give, then ask only for the missing ones, with multiple-choice questions
where the answer is a choice:

- **name**: kebab-case, e.g. `invoice-bot`
- **description**: one line saying what it does
- **type**: `ts` for a library, CLI or service; `nextjs` for a web app
- **visibility**: private (default) or public
- **releases**: off (default); on for packages you'll publish

Done when: all five values are known and the name matches `^[a-z0-9]+(-[a-z0-9]+)*$`.

## 2. Confirm

Show the exact command and wait for the user's explicit approval, because it creates a GitHub repo:

```bash
pnpm dlx @stavkamil/blueprint@1 new <name> --description "<description>" --type <type> --dir ~/Projects --json
```

Add `--public` for a public repo and `--release` for releases. Say it creates `~/Projects/<name>`.

Done when: the user has approved this exact command.

## 3. Create

Run the approved command as shown.

Done when: its JSON result is parsed, whether `ok` is true or false.

## 4. Report

Report only what the JSON says:

- **ok**: the repo URL (`project.url`), every `manualSteps` item as a checklist, and one next step: open
  `~/Projects/<name>` in Claude Code and start with a spec.
- **not ok**: each `problems` item (`message`, then `hint`). When `resumable` is true, give `resumeCommand` to run
  after the problem is fixed; otherwise give `project.dir` as the folder kept for inspection.

Done when: every `manualSteps` item, or the resume command or kept folder, is in your reply.
