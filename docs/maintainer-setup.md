# Maintainer setup

One-time setup for the `stavkamil/blueprint` repo and the `@stavkamil/blueprint` npm package. Do the steps in
order; each ends with a check. **Done when** every check passes.

Steps 5–7 must happen in one sitting: npm expects the first trusted publish within 2 days of adding the trusted
publisher.

## 1. Create the repo and push `main`

`main` holds only the initial commit (specs and plan); all package code arrives through the first PR.

```bash
git switch main
gh repo create stavkamil/blueprint --public --description "Agent-first SDLC and CI/CD setup for TypeScript projects" --source . --push
```

**Check:** `gh repo view stavkamil/blueprint` shows a public repo with `main` pushed.

## 2. Protect `main`

```bash
gh api repos/stavkamil/blueprint/rulesets --method POST --input .github/rulesets/main.json
gh api repos/stavkamil/blueprint --method PATCH \
  -F allow_merge_commit=false -F allow_rebase_merge=false -F allow_squash_merge=true \
  -f squash_merge_commit_title=PR_TITLE -f squash_merge_commit_message=PR_BODY \
  -F delete_branch_on_merge=true
gh api repos/stavkamil/blueprint/actions/permissions/workflow --method PUT \
  -f default_workflow_permissions=read -F can_approve_pull_request_reviews=false
```

**Check:** `gh api repos/stavkamil/blueprint/rulesets --jq '.[].name'` lists `blueprint-main`, and
`git push origin HEAD:main` from a test commit is rejected.

## 3. Create the release GitHub App

Release-please opens release PRs with this app's token, so CI runs on them; PRs opened with the default
`GITHUB_TOKEN` don't trigger workflows.

1. github.com → Settings → Developer settings → GitHub Apps → **New GitHub App**.
   - Name: `blueprint-release`. Homepage: the repo URL. Webhook: **off**.
   - Repository permissions: **Contents: Read and write**, **Pull requests: Read and write**. Nothing else.
   - Where can it be installed: **Only on this account**.
2. Create the app, note its **Client ID** (shown on the app page; the action no longer takes the App ID), and generate a **private key** (downloads a `.pem` file).
3. **Install App** → your account → **All repositories**. Projects created later with `--release` reuse this app.
4. Save the secrets in this repo, then delete the `.pem` file:

   ```bash
   gh secret set RELEASE_APP_CLIENT_ID -R stavkamil/blueprint          # paste the Client ID at the prompt
   gh secret set RELEASE_APP_PRIVATE_KEY -R stavkamil/blueprint < path/to/key.pem
   ```

**Check:** `gh secret list -R stavkamil/blueprint` shows both secrets.

## 4. Merge the foundation PR

```bash
git switch feat/repo-foundation && git push -u origin feat/repo-foundation
gh pr create --fill --title "feat: repo foundation"
```

Wait for `ci-ok`, resolve any review threads, and squash-merge it.

**Check:** `main` contains `package.json`, and release-please has opened a "release 1.0.0" PR with CI running on it.
**Leave that release PR open** until step 7.

## 5. Claim the npm name

```bash
npm login                       # with 2FA enabled on the account
git switch main && git pull && pnpm install --frozen-lockfile && pnpm build
npm publish --access public     # publishes 0.0.0, the placeholder that claims the name
```

**Check:** `npm view @stavkamil/blueprint version` prints `0.0.0`.

## 6. Switch npm to trusted publishing

On npmjs.com → `@stavkamil/blueprint` → Settings:

1. **Trusted publisher** → GitHub Actions → organization/user `stavkamil`, repository `blueprint`, workflow
   filename `release.yml` (no environment).
2. **Publishing access** → **Require two-factor authentication and disallow tokens**.

**Check:** the package settings page shows the trusted publisher and "disallow tokens".

## 7. First release

Merge the "release 1.0.0" PR from step 4. The release workflow publishes through trusted publishing and moves `v1`.

**Check:**

- npm shows `1.0.0` with a provenance badge
- `git ls-remote --tags origin` lists `v1.0.0` and `v1`
- `pnpm dlx @stavkamil/blueprint@1 --version` prints `1.0.0` outside the repo

Then remove `release-as` from `release-please-config.json` in a follow-up PR.

## Known issue: publish fails with "OIDC permission denied" (since 2026-10)

**Symptom:** the `publish` job of `release.yml` fails with
`403 Forbidden … OIDC permission denied for this action`, even though the trusted publisher allows publishing. The
provenance step before it succeeds.

**Cause:** GitHub gives repositories created after 2026-07-15 an immutable OIDC subject
(`repo:stavkamil@56508560/blueprint@1423650112:…` instead of `repo:stavkamil/blueprint:…`). npm's trusted publishing
doesn't accept that format yet: [npm/cli#9969](https://github.com/npm/cli/issues/9969), open. Switching the repo back
with `PUT /repos/{owner}/{repo}/actions/oidc/customization/sub` (`use_immutable_subject=false`) doesn't take effect;
tried on 2026-10-17.

**Workaround for each release until npm fixes it** (no tokens; uses your 2FA):

1. Let the release run fail at `publish`. The GitHub release and the `vX.Y.Z` tag already exist.
2. Publish that exact commit by hand:

   ```bash
   git fetch --tags && git switch --detach vX.Y.Z && pnpm install --frozen-lockfile && pnpm build && npm publish --access public && git switch main
   ```

3. Point the major tag at it (normally the `move-major-tag` job's work):

   ```bash
   gh api repos/stavkamil/blueprint/git/ref/tags/vX.Y.Z --jq .object.sha
   gh api --method POST repos/stavkamil/blueprint/git/refs -f ref=refs/tags/vMAJOR -f sha=<that sha>
   ```

   Once `vMAJOR` exists, move it instead:
   `gh api --method PATCH repos/stavkamil/blueprint/git/refs/tags/vMAJOR -f sha=<sha> -F force=true`.

Hand-published versions have no provenance badge. **Once npm/cli#9969 is fixed**, re-run the failed `publish` job of
the next release to confirm trusted publishing works, then delete this section.
