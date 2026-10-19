import type { GithubRepo } from "./types.ts";

const githubRemote = /github\.com[:/]([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/u;

/**
 * Reads the owner and repo name from a github.com remote URL (HTTPS or SSH); undefined for anything else.
 * @param url the remote URL from `git remote get-url origin`
 */
export const parseGithubRemote = (url: string): GithubRepo | undefined => {
  const match = githubRemote.exec(url.trim());
  return match?.[1] === undefined || match[2] === undefined
    ? undefined
    : { owner: match[1], name: match[2] };
};
