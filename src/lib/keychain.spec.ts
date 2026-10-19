import { describe, expect, it } from "vitest";

import { readKeychainSecret } from "./keychain.ts";
import { makeFakeRunCommand } from "./testing/fake-run-command.ts";

describe("readKeychainSecret", () => {
  it("returns the item's value", async () => {
    const { run, calls } = makeFakeRunCommand({ security: { stdout: "s3cret\n" } });

    const value = await readKeychainSecret(run, "claude-oauth-token");

    expect(value).toBe("s3cret");
    expect(calls[0]?.command).toBe(
      "security find-generic-password -s blueprint -a claude-oauth-token -w",
    );
  });

  it("returns undefined when the item is missing", async () => {
    const { run } = makeFakeRunCommand({ security: { exitCode: 44 } });

    const value = await readKeychainSecret(run, "release-app-key");

    expect(value).toBeUndefined();
  });
});
