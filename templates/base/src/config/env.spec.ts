import { describe, expect, it } from "vitest";

import { parseEnv } from "./env{{importExtension}}";

describe("parseEnv", () => {
  it("defaults LOG_LEVEL to info when it isn't set", () => {
    const source = {};

    const env = parseEnv(source);

    expect(env.LOG_LEVEL).toBe("info");
  });

  it("rejects an unknown LOG_LEVEL", () => {
    const source = { LOG_LEVEL: "loud" };

    const parse = (): unknown => parseEnv(source);

    expect(parse).toThrow();
  });
});
