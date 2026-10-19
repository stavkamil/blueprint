import type { GithubContext } from "../types.ts";

/**
 * Lists the repo's Actions secret names (never values), or returns GitHub's error message.
 * @param context the GitHub context
 */
export const readSecretNames = async (
  context: GithubContext,
): Promise<ReadonlySet<string> | string> => {
  const result = await context.getRepo("/actions/secrets");
  if (!result.ok) {
    return result.message;
  }
  const secrets =
    typeof result.body === "object" &&
    result.body !== null &&
    "secrets" in result.body &&
    Array.isArray(result.body.secrets)
      ? (result.body.secrets as readonly { readonly name?: unknown }[])
      : [];
  return new Set(secrets.map((secret) => String(secret.name)));
};
