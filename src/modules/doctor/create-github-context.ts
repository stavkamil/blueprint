import type { GhApi, GhApiResult } from "../../lib/gh-api.ts";
import type { RunCommand } from "../../lib/run-command.ts";
import type { GithubContext, GithubRepo } from "./types.ts";

/**
 * Builds the context checks share. Each GitHub resource is fetched at most once, so a full run stays fast and within
 * a handful of API calls.
 * @param dir the project folder
 * @param repo the GitHub repo behind `origin`
 * @param run runs external commands
 * @param ghApi calls GitHub's REST API
 */
export const createGithubContext = (
  dir: string,
  repo: GithubRepo,
  run: RunCommand,
  ghApi: GhApi,
): GithubContext => {
  const cache = new Map<string, Promise<GhApiResult>>();
  const getRepo = (suffix = ""): Promise<GhApiResult> => {
    const path = `repos/${repo.owner}/${repo.name}${suffix}`;
    const cached = cache.get(path) ?? ghApi(path);
    cache.set(path, cached);
    return cached;
  };
  return { dir, run, ghApi, repo, getRepo };
};
