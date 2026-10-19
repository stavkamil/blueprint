import type { RunCommand } from "./run-command.ts";

/** An HTTP method `gh api` sends. */
export const HttpMethod = { Get: "GET", Post: "POST", Put: "PUT", Patch: "PATCH" } as const;

/** One of {@link HttpMethod}'s values. */
export type HttpMethod = (typeof HttpMethod)[keyof typeof HttpMethod];

/** A `gh api` answer: the parsed body on success, or GitHub's error message. */
export type GhApiResult =
  | { readonly ok: true; readonly body: unknown }
  | { readonly ok: false; readonly status: number; readonly message: string };

/** One GitHub REST call through the logged-in `gh`, so blueprint never handles a GitHub token itself. */
export type GhApi = (
  path: string,
  options?: { readonly method?: HttpMethod; readonly body?: unknown },
) => Promise<GhApiResult>;

const statusPattern = /HTTP (\d{3})/u;
const unknownStatus = 0;

const parseBody = (text: string): unknown => {
  if (text.trim() === "") {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

/**
 * Builds a {@link GhApi} on top of a command runner. Request bodies go on stdin (`--input -`).
 * @param run runs `gh`; tests pass a fake
 */
export const createGhApi =
  (run: RunCommand): GhApi =>
  async (path, options = {}) => {
    const method = options.method ?? HttpMethod.Get;
    const args = ["api", "--method", method, path];
    const hasBody = options.body !== undefined;
    const result = await run("gh", hasBody ? [...args, "--input", "-"] : args, {
      input: hasBody ? JSON.stringify(options.body) : undefined,
    });
    if (result.exitCode === 0) {
      return { ok: true, body: parseBody(result.stdout) };
    }
    const body = parseBody(result.stdout);
    const message =
      typeof body === "object" && body !== null && "message" in body
        ? String(body.message)
        : result.stderr.trim();
    const status = Number(statusPattern.exec(result.stderr)?.[1] ?? unknownStatus);
    return { ok: false, status, message };
  };
