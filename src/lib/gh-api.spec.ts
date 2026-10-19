import { describe, expect, it } from "vitest";

import { createGhApi, HttpMethod } from "./gh-api.ts";
import { makeFakeRunCommand } from "./testing/fake-run-command.ts";

describe("createGhApi", () => {
  it("returns the parsed body of a successful call", async () => {
    const { run, calls } = makeFakeRunCommand({ "gh api": { stdout: '{"private":true}' } });
    const ghApi = createGhApi(run);

    const result = await ghApi("repos/ada/demo");

    expect(result).toEqual({ ok: true, body: { private: true } });
    expect(calls[0]?.command).toBe("gh api --method GET repos/ada/demo");
  });

  it("sends the request body on stdin, never in the arguments", async () => {
    const { run, calls } = makeFakeRunCommand();
    const ghApi = createGhApi(run);

    await ghApi("repos/ada/demo", { method: HttpMethod.Patch, body: { allow_squash_merge: true } });

    expect(calls[0]).toMatchObject({
      command: "gh api --method PATCH repos/ada/demo --input -",
      input: '{"allow_squash_merge":true}',
    });
  });

  it("returns GitHub's status and message on failure", async () => {
    const { run } = makeFakeRunCommand({
      "gh api": {
        exitCode: 1,
        stdout:
          '{"message":"Upgrade to GitHub Pro or make this repository public to enable this feature."}',
        stderr: "gh: Upgrade to GitHub Pro (HTTP 403)",
      },
    });
    const ghApi = createGhApi(run);

    const result = await ghApi("repos/ada/demo/rulesets", { method: HttpMethod.Post, body: {} });

    expect(result).toEqual({
      ok: false,
      status: 403,
      message: "Upgrade to GitHub Pro or make this repository public to enable this feature.",
    });
  });

  it("treats an empty success body as no content", async () => {
    const { run } = makeFakeRunCommand();
    const ghApi = createGhApi(run);

    const result = await ghApi("repos/ada/demo/vulnerability-alerts");

    expect(result).toEqual({ ok: true, body: undefined });
  });
});
