import { describe, expect, it } from "vitest";

import { parseGithubRemote } from "./parse-github-remote.ts";

describe("parseGithubRemote", () => {
  it.each([
    "https://github.com/ada/my-app.git",
    "https://github.com/ada/my-app",
    "git@github.com:ada/my-app.git",
    "ssh://git@github.com/ada/my-app.git\n",
  ])("reads owner and name from %s", (url) => {
    const repo = parseGithubRemote(url);

    expect(repo).toEqual({ owner: "ada", name: "my-app" });
  });

  it("ignores remotes on other hosts", () => {
    const repo = parseGithubRemote("https://gitlab.com/ada/my-app.git");

    expect(repo).toBeUndefined();
  });
});
