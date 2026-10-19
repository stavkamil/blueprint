import type { JsonObject, JsonValue } from "./types.ts";

const isObject = (value: JsonValue | undefined): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Deep-merges package.json parts, later parts winning, so layers can add scripts and dependencies without
 * repeating each other. Arrays are replaced, not concatenated. Key order follows first appearance.
 * @param parts the package.json parts, lowest priority first
 */
export const mergePackageJson = (...parts: readonly JsonObject[]): JsonObject =>
  parts.reduce<JsonObject>((merged, part) => {
    const result: Record<string, JsonValue> = { ...merged };
    for (const [key, value] of Object.entries(part)) {
      const current = result[key];
      result[key] = isObject(current) && isObject(value) ? mergePackageJson(current, value) : value;
    }
    return result;
  }, {});
