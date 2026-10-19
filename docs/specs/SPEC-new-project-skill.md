# Spec: new-project-skill

Module 8 of 8 in [CAPABILITY-MAP.md](CAPABILITY-MAP.md). Depends on `cli-new`.

**As built (2026-10-19), differences from the design below:**

- **The command passes `--dir ~/Projects`** instead of running from `~/Projects`, so the skill doesn't depend on the session's working folder.
- **The skill reads its arguments through `$ARGUMENTS`** and reports `problems` (`message`, `hint`) from the JSON on failure.
- **Phone guide:** fixes come from Auto-fix or the session, and a second review from re-running `ai-review`. The `@claude …` comment trigger was dropped in `ci-workflows` (zizmor rates `issue_comment` high risk).
- **Cloud setup script finalized:** Node 24 from nodejs.org, checked against its `SHASUMS256.txt`, and gitleaks 8.30.1, pinned and checksum-verified (the same pin as CI). The checksum lookup was tested against nodejs.org; the full script still needs one run in a real cloud environment (setup check 7).
- **The guard test** (`tests/skill.spec.ts`) compares the skill's flags with `blueprint new --help` rather than parsing `cli-new`'s options.
- **Still manual before the first release:** the three `/new-project` runs, the setup checks, and the phone tasks (criteria 2, 3, 5, 7 and 8).

## Objective

Give you two things:

1. **The `/new-project` skill.** You type it in Claude Code, answer a few questions, approve one command, and get a fully set-up project.
2. **Two guides:** the **one-time setup** that makes everything else work, and **working from your phone**.

The skill is written with the [writing-for-agents](https://github.com/mattpocock/skills/blob/main/skills/productivity/writing-for-agents/SKILL.md) principles:

- user-invoked, so it costs no context until you call it
- ordered steps, each with a checkable completion criterion
- positive instructions
- nothing restated that the CLI or `--help` already says

**Users:** you (in a local Claude Code session on your Mac, or from your phone via Remote Control into that session).

**Scope:** `skill/new-project/SKILL.md`, `docs/setup.md`, `docs/phone.md`, and how the skill is installed.
**Out of scope:**

- what the CLI does (`cli-new`, `cli-doctor`)
- creating projects from cloud sessions: user skills don't load there, and project creation needs your Keychain and `gh` login

### Acceptance criteria

1. **User-invoked.** `SKILL.md` has `disable-model-invocation: true` and a one-line human-facing description, so it never fires on its own and adds no always-loaded context.
2. **Fewer questions when you already said it.** `/new-project` with everything in the arguments (e.g. `/new-project invoice-bot, ts, "Telegram bot that files invoices"`) asks no questions except the final approval.
3. **Interview only for what's missing.** `/new-project` with no arguments asks for: name, description, type, private/public, releases. It uses multiple-choice questions where the answer is a choice, and validates the name as kebab-case before moving on.
4. **Show, then wait.** Before running anything, the skill shows the exact `blueprint new` command and waits for your explicit approval. It creates a GitHub repo, which is outward-facing and hard to undo.
5. **Reports from the CLI's JSON, never invented.** On success: repo URL, every `manualSteps` item, and one next step. On failure: the failing step, and either the exact `resumeCommand` from the result or, when `resumable` is false, the kept folder path to inspect.
6. **Short.** `SKILL.md` is under 80 lines. Each step ends with a completion criterion.
7. **Setup guide is complete and checkable.** Following `docs/setup.md` on a clean Mac, `blueprint new demo --type ts --description "setup check" --no-github` succeeds. A full run then produces a repo where `blueprint doctor` passes, with only `app.claude` pending until the first AI review.
8. **Phone guide works.** Following `docs/phone.md`, you can (a) watch and steer a cloud session from the Claude app, (b) run `/new-project` through Remote Control, and (c) get a GitHub Mobile notification for a PR that's ready, and merge it from the phone.

## The skill

**Location and install:** `skill/new-project/SKILL.md` in the blueprint repo, symlinked once:
`ln -s ~/Projects/blueprint/skill/new-project ~/.claude/skills/new-project` (a step in `docs/setup.md`).
Updating the blueprint repo updates the skill.

**Frontmatter:**

```yaml
---
name: new-project
description: Create a new project with blueprint's full setup (repo, CI, standards, agent config).
disable-model-invocation: true
---
```

**Steps** (the SKILL.md body is these steps, with the completion criterion as the last line of each):

1. **Gather.** Take any values already in the arguments, then ask only for the missing ones:
   - name (kebab-case)
   - one-line description
   - type: `ts` for a library, CLI or service; `nextjs` for a web app
   - visibility (private by default)
   - releases (off by default; on for packages you'll publish)

   _Done when:_ all five values are known and the name matches `^[a-z0-9]+(-[a-z0-9]+)*$`.

2. **Confirm.** Show the exact command (`pnpm dlx @stavkamil/blueprint@1 new … --json`) and the folder it will create in, and ask for approval.
   _Done when:_ you've explicitly approved this command.
3. **Create.** Run the command from `~/Projects`.
   _Done when:_ the JSON result is parsed (whether it succeeded or not).
4. **Report.** On success: the repo URL, every `manualSteps` item as a checklist, and one next step ("open `~/Projects/<name>` in Claude Code and start with a spec"). On failure: the step that failed, its message, and either `resumeCommand` (resumable) or the kept folder to inspect (not resumable).
   _Done when:_ every `manualSteps` item, or the resume command or folder path, is in your reply.

**Writing rules for the body:**

- Leading words: _gather_, _confirm_, _create_, _report_.
- Type guidance is a single line.
- No restating of CLI flags beyond the one command.
- The only prohibition is the guardrail in step 2 (run only after approval), phrased as what to do.

## `docs/setup.md`: one-time setup

Ordered steps, each with a check you can run. **Done when** every check passes.

| #   | Step                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Check                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| 1   | Upgrade GitHub to **Pro** (rulesets on private repos)                                                                                                                                                                                                                                                                                                                                                                                                                                                              | github.com/settings/billing shows Pro                                                                     |
| 2   | Install tools: `brew install gh gitleaks fnm`, `fnm install 24`, `corepack enable pnpm`; set your git identity (`git config --global user.name …` / `user.email …`)                                                                                                                                                                                                                                                                                                                                                | `gh --version`, `gitleaks version`, `node -v` (24.x), `pnpm -v`, `git config user.email`                  |
| 3   | `gh auth login` (HTTPS, browser)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `gh auth status`                                                                                          |
| 4   | Install the **Claude GitHub App** for **All repositories**                                                                                                                                                                                                                                                                                                                                                                                                                                                         | github.com/settings/installations lists Claude, set to all repositories                                   |
| 5   | Create a **Claude token** for CI: `claude setup-token`, then save it with its creation date: `security add-generic-password -s blueprint -a claude-oauth-token -j "created:$(date +%F)" -w`. With no value after `-w`, it prompts, so the token stays out of shell history. Repeat yearly, then run `blueprint doctor --fix` in each repo                                                                                                                                                                          | `security find-generic-password -s blueprint -a claude-oauth-token` finds it, with the `created:` comment |
| 6   | **Optional, only before your first `--release` project.** Use the `blueprint-release` GitHub App (created in blueprint's maintainer setup; Contents + Pull requests: read & write; installed on all repositories). Save its Client ID: `security add-generic-password -s blueprint -a release-app-client-id -w`. Save its private key base64-encoded, since the PEM spans multiple lines: `security add-generic-password -s blueprint -a release-app-key -w "$(base64 -i <key>.pem)"`. Then delete the `.pem` file | both Keychain items are found                                                                             |
| 7   | Create the **cloud environment** at claude.ai/code: network **Trusted**, plus the **setup script** below                                                                                                                                                                                                                                                                                                                                                                                                           | a new cloud session on any blueprint repo runs `pnpm test` successfully                                   |
| 8   | Claude Code settings: **Remote Control for all sessions** (Desktop: Settings → Claude Code), **Require trusted devices** (claude.ai settings), auto permission mode                                                                                                                                                                                                                                                                                                                                                | the Claude app shows your running local session                                                           |
| 9   | Install the skill (symlink above)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `/new-project` appears in Claude Code's command list                                                      |
| 10  | Smoke test: `pnpm dlx @stavkamil/blueprint@1 new setup-check --type ts --description "setup check" --no-github` in a temp folder                                                                                                                                                                                                                                                                                                                                                                                   | it succeeds; delete the folder afterwards                                                                 |

**Cloud environment setup script** (cached by the environment, so it runs about once a week):

```bash
#!/bin/bash
set -euo pipefail
# Node 24 (cloud images ship 22), pnpm, and gitleaks for the pre-commit hook
curl -fsSL https://nodejs.org/dist/latest-v24.x/ | grep -o 'node-v24[^"]*-linux-x64.tar.xz' | head -1 \
  | xargs -I{} sh -c 'curl -fsSL https://nodejs.org/dist/latest-v24.x/{} | tar -xJ -C /usr/local --strip-components=1'
corepack enable pnpm
GITLEAKS_VERSION=<pinned>   # set at implementation, with checksum verification
curl -fsSL "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz" \
  | tar -xz -C /usr/local/bin gitleaks
```

The exact script, including checksum verification and the pinned gitleaks version, is finalized and tested at
implementation (check 7). Each project's SessionStart hook then installs dependencies.

## `docs/phone.md`: working from your phone

Short sections, each tied to a task:

- **Start or steer work:** Claude app → Code → a cloud session or Project on the repo. Work continues with your laptop closed. Answer questions and approvals inside the session or thread that asks.
- **Use your Mac from the phone:** sessions on the Mac appear in the Claude app (Remote Control, set up in step 8). This is how to run `/new-project` from the phone. The Mac must be awake.
- **Get told when something needs you:** GitHub Mobile with notifications set to _Participating_ plus _Pull requests_ and _failed workflows_ for your repos. A PR from an agent arrives as a notification.
- **Review and merge:** open the PR in GitHub Mobile, read the AI review and the CI result, resolve threads, and merge (squash). Ask for fixes by turning on Auto-fix in the Claude app or by replying in the session.
- **What only works on the Mac:** creating projects (the Keychain and `gh` live there), and running `blueprint doctor --fix`.

## Project Structure

```
skill/new-project/SKILL.md
docs/
├── setup.md
└── phone.md
```

## Testing Strategy

- **Automated:** a test checks:
  - `SKILL.md` frontmatter (`disable-model-invocation: true`, name, a one-line description)
  - its length (under 80 lines)
  - that each of the four steps ends with a "Done when" line
  - that the command in step 2 matches the current CLI flags (parsed from `cli-new`'s options)
- **Manual before v1:**
  - Run `/new-project` three ways: all values given (criterion 2), none given (3), and against a name whose repo already exists, which must relay the CLI's preflight refusal and its fix, with nothing created (5).
  - Follow `setup.md` on your Mac and tick every check (7).
  - Do the three phone tasks (8).

## Boundaries

- **Always:**
  - Show the exact command and get approval before running it.
  - Report from the CLI's JSON.
  - Keep the skill user-invoked.
- **Ask first:**
  - Making the skill model-invoked.
  - Adding steps (e.g. writing a first spec automatically).
  - Changing the guides' recommended settings.
- **Never:**
  - Run `blueprint new` without approval of the exact command.
  - Ask for, display or store secrets in the conversation.
  - Restate CLI behavior in the skill.

## Success Criteria

- Acceptance criteria 1–8 pass.
- From `/new-project` to a repo with green CI takes about two minutes, and only the approval when you give everything in the arguments.

## Resolved Questions

1. **Release app (setup step 6):** optional, done only before your first `--release` project.
2. **After creating:** the skill stops at the report. Starting work on the new project is your call.
