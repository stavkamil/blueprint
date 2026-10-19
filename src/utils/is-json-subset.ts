/**
 * True when every value in `expected` appears in `actual`: objects may have extra keys, arrays must match item by item.
 * Lets doctor compare GitHub settings without failing on fields GitHub adds later.
 * @param expected the values that must be present
 * @param actual the values found
 */
export const isJsonSubset = (expected: unknown, actual: unknown): boolean => {
  if (Array.isArray(expected)) {
    return (
      Array.isArray(actual) &&
      expected.length === actual.length &&
      expected.every((item, index) => isJsonSubset(item, actual[index]))
    );
  }
  if (typeof expected === "object" && expected !== null) {
    return (
      typeof actual === "object" &&
      actual !== null &&
      !Array.isArray(actual) &&
      Object.entries(expected).every(([key, value]) =>
        isJsonSubset(value, (actual as Record<string, unknown>)[key]),
      )
    );
  }
  return Object.is(expected, actual);
};
