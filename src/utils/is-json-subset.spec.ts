import { describe, expect, it } from "vitest";

import { isJsonSubset } from "./is-json-subset.ts";

describe("isJsonSubset", () => {
  it("accepts extra keys in the actual object", () => {
    const actual = { enforcement: "active", added_by_github: true };

    const isSubset = isJsonSubset({ enforcement: "active" }, actual);

    expect(isSubset).toBe(true);
  });

  it("rejects a different nested value", () => {
    const actual = { parameters: { required_approving_review_count: 1 } };

    const isSubset = isJsonSubset({ parameters: { required_approving_review_count: 0 } }, actual);

    expect(isSubset).toBe(false);
  });

  it("requires arrays to match in length and order", () => {
    expect(isJsonSubset([], [{ actor_id: 1 }])).toBe(false);
    expect(isJsonSubset(["squash"], ["squash"])).toBe(true);
  });

  it("rejects a missing object", () => {
    expect(isJsonSubset({ a: 1 }, undefined)).toBe(false);
  });
});
