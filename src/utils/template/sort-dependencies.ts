import type { JsonObject, JsonValue } from "./types.ts";

const dependencyFields = ["dependencies", "devDependencies", "peerDependencies"];

const sortKeys = (value: JsonValue | undefined): JsonValue | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)))
    : value;

/**
 * Sorts each dependency list by package name, the order pnpm writes, so the first `pnpm add` doesn't reshuffle them.
 * @param packageJson the package.json to sort
 */
export const sortDependencies = (packageJson: JsonObject): JsonObject =>
  Object.fromEntries(
    Object.entries(packageJson).map(([key, value]) => [
      key,
      dependencyFields.includes(key) ? (sortKeys(value) ?? value) : value,
    ]),
  );
