import { describe, expect, it } from "vitest";

import { greet } from "./index.ts";

describe("greet", () => {
  it("greets the given name", () => {
    const name = "Ada";

    const greeting = greet(name);

    expect(greeting).toBe("Hello, Ada!");
  });
});
