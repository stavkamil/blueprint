# One-time setup

Do these once per Mac, in order. Each step has a check; you're done when every check passes.

## 1. GitHub Pro

Upgrade at [github.com/settings/billing](https://github.com/settings/billing). Rulesets on private repos need it,
and blueprint relies on a ruleset to keep agents from pushing straight to `main`.

**Check:** the billing page shows Pro.

## 2. Tools

```bash
brew install gh gitleaks fnm
fnm install 24
corepack enable pnpm
git config --global user.name "Your Name"
git config --global user.email you@example.com
```

**Check:** `gh --version`, `gitleaks version`, `node -v` (24.x), `pnpm -v` and `git config user.email` all answer.

## 3. GitHub login

```bash
gh auth login
```

Pick GitHub.com, HTTPS and the browser.

**Check:** `gh auth status` says you're logged in.

## 4. Claude GitHub App

Install [the Claude app](https://github.com/apps/claude) for **All repositories**, so the AI review works in every
new repo without another step.

**Check:** [github.com/settings/installations](https://github.com/settings/installations) lists Claude with access to
all repositories.

## 5. Claude token for CI

The AI review runs with a long-lived token. Create it, then save it in the Keychain with today's date:

```bash
claude setup-token
security add-generic-password -s blueprint -a claude-oauth-token -j "created:$(date +%F)" -w
```

With nothing after `-w`, `security` prompts for the token, so it stays out of your shell history. The token lasts a
year: repeat this step then, and run `blueprint doctor --fix` in each repo.

**Check:** `security find-generic-password -s blueprint -a claude-oauth-token` finds the item, with a `created:`
comment.

## 6. Release app (only before your first `--release` project)

Release PRs need a GitHub App token so CI runs on them. Use the `blueprint-release` app (Contents and Pull requests:
read and write, installed on all repositories). From its settings page, copy the Client ID and generate a private
key, then save both:

```bash
security add-generic-password -s blueprint -a release-app-client-id -w
security add-generic-password -s blueprint -a release-app-key -w "$(base64 -i <downloaded-key>.pem)"
rm <downloaded-key>.pem
```

The key is saved base64-encoded because it spans several lines.

**Check:** `security find-generic-password -s blueprint -a release-app-client-id` and `… -a release-app-key` both find
an item.

## 7. Cloud environment

At [claude.ai/code](https://claude.ai/code), create an environment with network access **Trusted** and this setup
script. It installs Node 24, pnpm and gitleaks (for the commit hook); the environment caches it, so it runs about once
a week. Each project's own SessionStart hook installs its dependencies.

```bash
#!/bin/bash
set -euo pipefail

# Node 24, checked against nodejs.org's published checksums
NODE_DIST=https://nodejs.org/dist/latest-v24.x
NODE_ARCHIVE=$(curl -fsSL "$NODE_DIST/SHASUMS256.txt" | grep -o 'node-v24[^ ]*-linux-x64\.tar\.xz')
curl -fsSLO "$NODE_DIST/$NODE_ARCHIVE"
curl -fsSL "$NODE_DIST/SHASUMS256.txt" | grep " $NODE_ARCHIVE\$" | sha256sum --check --strict
tar -xJf "$NODE_ARCHIVE" -C /usr/local --strip-components=1
rm "$NODE_ARCHIVE"
corepack enable pnpm

# gitleaks, pinned and checksum-verified (same version as blueprint's CI)
GITLEAKS_VERSION=8.30.1
GITLEAKS_SHA256=551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb
GITLEAKS_ARCHIVE="gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz"
curl -fsSLO "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/${GITLEAKS_ARCHIVE}"
echo "${GITLEAKS_SHA256}  ${GITLEAKS_ARCHIVE}" | sha256sum --check --strict
tar -xzf "$GITLEAKS_ARCHIVE" -C /usr/local/bin gitleaks
rm "$GITLEAKS_ARCHIVE"
```

**Check:** a new cloud session on any blueprint repo runs `pnpm test` successfully.

## 8. Claude Code settings

- Claude Desktop → Settings → Claude Code: turn on **Remote Control** for all sessions, so your Mac's sessions show
  up in the Claude app on your phone.
- claude.ai settings: turn on **Require trusted devices**.
- Use **auto** permission mode. Each project's `.claude/settings.json` already allows the routine commands and asks
  before workflow edits and new dependencies.

**Check:** the Claude app on your phone shows a session running on your Mac.

## 9. The `/new-project` skill

```bash
mkdir -p ~/.claude/skills
ln -s ~/Projects/blueprint/skill/new-project ~/.claude/skills/new-project
```

Pulling the blueprint repo updates the skill.

**Check:** `/new-project` appears in Claude Code's command list.

## 10. Smoke test

```bash
cd "$(mktemp -d)"
pnpm dlx @stavkamil/blueprint@1 new setup-check --type ts --description "setup check" --no-github
```

**Check:** it ends with `Project: …/setup-check`. Delete the temp folder afterwards.
