import { describe, expect, it } from "vitest";

import { runDoctor } from "./run-doctor.ts";
import { type FixtureOptions, makeDoctorFixture } from "./testing/make-doctor-fixture.ts";
import type { DoctorResult } from "./types.ts";

const doctor = async (
  options: FixtureOptions = {},
  isFix = false,
): Promise<{ readonly result: DoctorResult } & Awaited<ReturnType<typeof makeDoctorFixture>>> => {
  const fixture = await makeDoctorFixture(options);
  const result = await runDoctor({
    dir: fixture.dir,
    fix: isFix,
    run: fixture.run,
    ghApi: fixture.ghApi,
  });
  return { result, ...fixture };
};

const failureOf = (result: DoctorResult, id: string) =>
  result.checks.find((check) => check.id === id && check.status === "fail");

const writesOf = (apiCalls: readonly string[]): readonly string[] =>
  apiCalls.filter((call) => !call.startsWith("GET "));

describe("runDoctor", () => {
  it("passes a healthy project, fetching each GitHub resource once", async () => {
    const { result, apiCalls } = await doctor();

    expect(result).toMatchObject({ ok: true, isLocalOnly: false, fixed: [] });
    expect(new Set(apiCalls).size).toBe(apiCalls.length);
    expect(apiCalls.length).toBeLessThan(15);
  });

  it("refuses to run outside a git repository", async () => {
    const { result } = await doctor({ isGitRepo: false });

    expect(result.ok).toBe(false);
    expect(result.blocked?.title).toContain("isn't a git repository");
  });

  it("refuses to run when gh is logged out and the project has a GitHub remote", async () => {
    const { result } = await doctor({ isGhLoggedIn: false });

    expect(result.blocked?.action).toBe("brew install gh, then gh auth login");
  });

  it("runs local checks only when there's no GitHub remote", async () => {
    const { result, apiCalls } = await doctor({ origin: "" });

    expect(result.ok).toBe(true);
    expect(result.isLocalOnly).toBe(true);
    expect(apiCalls).toEqual([]);
    expect(result.checks.find((check) => check.id === "repo.ruleset")?.status).toBe("skipped");
  });

  it("explains a failed GitHub read with the next step", async () => {
    const { result } = await doctor({ github: { "": undefined } });

    expect(failureOf(result, "repo.merge")).toMatchObject({
      title: "Couldn't read the repo settings: Not Found",
      action: "Check `gh auth status` and your network, then run blueprint doctor again.",
    });
  });

  it("reports problems without changing anything when --fix is off", async () => {
    const { result, apiCalls, commands } = await doctor({
      hasHooks: false,
      github: { "/rulesets": [] },
    });

    expect(failureOf(result, "hooks.installed")?.title).toBe("The git hooks aren't installed");
    expect(failureOf(result, "repo.ruleset")?.action).toBe("blueprint doctor --fix");
    expect(writesOf(apiCalls)).toEqual([]);
    expect(commands.some((call) => call.command.includes("lefthook install"))).toBe(false);
  });
});

describe("runDoctor --fix", () => {
  it("repairs a bare repo, then passes, and a second run writes nothing", async () => {
    const options: FixtureOptions = {
      hasHooks: false,
      github: {
        "": { allow_merge_commit: true, allow_squash_merge: true },
        "/rulesets": [],
        "/actions/permissions/workflow": {
          default_workflow_permissions: "write",
          can_approve_pull_request_reviews: true,
        },
        "/vulnerability-alerts": undefined,
        "/automated-security-fixes": { enabled: false },
        "/actions/secrets": { secrets: [] },
      },
    };
    const fixture = await makeDoctorFixture(options);
    const fix = (): Promise<DoctorResult> =>
      runDoctor({ dir: fixture.dir, fix: true, run: fixture.run, ghApi: fixture.ghApi });

    const first = await fix();
    const writesAfterFirst = writesOf(fixture.apiCalls).length;
    const second = await fix();

    expect(first.ok).toBe(true);
    expect(first.fixed).toEqual([
      "Git hooks",
      "Merge settings",
      "Ruleset blueprint-main",
      "Workflow token permissions",
      "Dependabot security updates",
      "CLAUDE_CODE_OAUTH_TOKEN secret",
    ]);
    expect(second).toMatchObject({ ok: true, fixed: [] });
    expect(writesOf(fixture.apiCalls)).toHaveLength(writesAfterFirst);
  });

  it("sets merge settings to squash only, titled by the PR", async () => {
    const { result, state } = await doctor({ github: { "": { allow_merge_commit: true } } }, true);

    expect(result.fixed).toEqual(["Merge settings"]);
    expect(state.get("repos/ada/demo")).toMatchObject({
      allow_squash_merge: true,
      allow_merge_commit: false,
      squash_merge_commit_title: "PR_TITLE",
      delete_branch_on_merge: true,
    });
  });

  it("updates an out-of-date ruleset in place, by its id", async () => {
    const { result, apiCalls } = await doctor(
      {
        github: {
          "/rulesets/1": { name: "blueprint-main", bypass_actors: [{ actor_id: 5 }], rules: [] },
        },
      },
      true,
    );

    expect(result.fixed).toEqual(["Ruleset blueprint-main"]);
    expect(apiCalls).toContain("PUT repos/ada/demo/rulesets/1");
  });

  it("fails loudly with both fixes when GitHub needs Pro for the ruleset", async () => {
    const { result } = await doctor(
      {
        github: { "/rulesets": [] },
        failingWrites: {
          "POST repos/ada/demo/rulesets":
            "Upgrade to GitHub Pro or make this repository public to enable this feature.",
        },
      },
      true,
    );

    expect(result.ok).toBe(false);
    expect(failureOf(result, "repo.ruleset")).toMatchObject({
      title: "GitHub refused the ruleset: private repos need GitHub Pro for rulesets",
      why: "Without the ruleset, agents could push straight to main and merge without green CI.",
      action:
        "Upgrade to GitHub Pro (https://github.com/settings/billing) or make the repo public, then run blueprint doctor --fix",
    });
  });

  it("copies the Claude token from the Keychain through stdin only", async () => {
    const { result, commands } = await doctor(
      { github: { "/actions/secrets": { secrets: [] } } },
      true,
    );

    const set = commands.find((call) => call.command.startsWith("gh secret set"));
    expect(result.ok).toBe(true);
    expect(set).toEqual({
      command: "gh secret set CLAUDE_CODE_OAUTH_TOKEN --repo ada/demo",
      input: "sk-test-token",
    });
    expect(JSON.stringify(result)).not.toContain("sk-test-token");
  });

  it("names the exact Keychain command when the token isn't saved", async () => {
    const { result } = await doctor(
      { keychain: {}, github: { "/actions/secrets": { secrets: [] } } },
      true,
    );

    expect(failureOf(result, "secret.claude")).toMatchObject({
      title: "The Keychain has no 'claude-oauth-token' item (service blueprint)",
      action:
        'security add-generic-password -s blueprint -a claude-oauth-token -j "created:$(date +%F)" -w, then blueprint doctor --fix',
    });
  });

  it("skips release secrets without a release workflow", async () => {
    const { result } = await doctor({
      github: { "/actions/secrets": { secrets: [{ name: "CLAUDE_CODE_OAUTH_TOKEN" }] } },
    });

    expect(result.checks.find((check) => check.id === "secret.release")?.status).toBe("skipped");
  });

  it("sets both release secrets, decoding the base64 key in memory", async () => {
    const key = "-----BEGIN KEY-----\nabc\n-----END KEY-----\n";
    const { result, commands } = await doctor(
      {
        hasReleaseWorkflow: true,
        keychain: {
          "claude-oauth-token": "sk-test-token",
          "release-app-client-id": "Iv1.client",
          "release-app-key": Buffer.from(key).toString("base64"),
        },
        github: { "/actions/secrets": { secrets: [{ name: "CLAUDE_CODE_OAUTH_TOKEN" }] } },
      },
      true,
    );

    expect(result.fixed).toEqual(["Release app secrets"]);
    expect(commands.filter((call) => call.command.startsWith("gh secret set"))).toEqual([
      { command: "gh secret set RELEASE_APP_CLIENT_ID --repo ada/demo", input: "Iv1.client" },
      { command: "gh secret set RELEASE_APP_PRIVATE_KEY --repo ada/demo", input: key },
    ]);
  });

  it("reports a write GitHub refuses with its message", async () => {
    const { result } = await doctor(
      {
        github: { "/actions/permissions/workflow": { default_workflow_permissions: "write" } },
        failingWrites: {
          "PUT repos/ada/demo/actions/permissions/workflow": "Resource not accessible",
        },
      },
      true,
    );

    expect(failureOf(result, "actions.permissions")?.title).toBe(
      "Couldn't update the Actions permissions: Resource not accessible",
    );
  });
});
