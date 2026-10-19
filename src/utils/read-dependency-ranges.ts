import { readFile } from "node:fs/promises";

const isRangeMap = (value: unknown): value is Record<string, string> =>
  typeof value === "object" &&
  value !== null &&
  Object.values(value).every((range) => typeof range === "string");

/**
 * Reads blueprint's own dependency ranges, so new projects get the exact tool versions blueprint is tested with and
 * Dependabot bumps them in one place.
 * @param packageJsonUrl blueprint's package.json
 */
export const readDependencyRanges = async (
  packageJsonUrl: URL,
): Promise<Readonly<Record<string, string>>> => {
  const pkg: unknown = JSON.parse(await readFile(packageJsonUrl, "utf8"));
  if (typeof pkg !== "object" || pkg === null) {
    return {};
  }
  const dependencies =
    "dependencies" in pkg && isRangeMap(pkg.dependencies) ? pkg.dependencies : {};
  const devDependencies =
    "devDependencies" in pkg && isRangeMap(pkg.devDependencies) ? pkg.devDependencies : {};
  return { ...dependencies, ...devDependencies };
};
