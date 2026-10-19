# Working from your phone

What you can do from the Claude app and GitHub Mobile, and the two things that need your Mac. Setup steps 7 and 8 in
[setup.md](setup.md) make this work.

## Start or steer work

Claude app → Code → start a cloud session on the repo. The work continues with your laptop closed. Answer questions
and approve actions inside the session that asks. When the agent opens a PR, the PR is where review happens.

## Use your Mac from the phone

Sessions running on your Mac show up in the Claude app (Remote Control). Use one to run `/new-project` from your
phone. The Mac must be awake and Claude Desktop open.

## Get told when something needs you

In GitHub Mobile, set notifications to **Participating**, plus **Pull requests** and **failed workflows** for your
repos. A PR an agent opens arrives as a notification.

## Review and merge

Open the PR in GitHub Mobile and read three things: the AI review comments, the `ci / ci-ok` result, and the PR
description's Testing and Risk sections. Then:

- **To get fixes:** turn on Auto-fix for the PR in the Claude app session that opened it, or reply in the session.
  Auto-fix also addresses review comments.
- **To review again** after new pushes: re-run the PR's latest `ai-review` run (Actions tab → the run → Re-run).
- **To merge:** resolve every conversation (the ruleset requires it), then **Squash and merge**.

## Mac only

- Creating projects: `blueprint new` reads your Keychain and uses your `gh` login.
- `blueprint doctor --fix`, for the same reason.
