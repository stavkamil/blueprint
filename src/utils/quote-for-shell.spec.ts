import { describe, expect, it } from "vitest";

import { quoteForShell } from "./quote-for-shell.ts";

describe("quoteForShell", () => {
  it.each([
    ["demo", "demo"],
    ["/Users/ada/projects", "/Users/ada/projects"],
    ["A demo", "'A demo'"],
    ["Ada's app", String.raw`'Ada'\''s app'`],
  ])("quotes %s as %s", (arg, quoted) => {
    expect(quoteForShell(arg)).toBe(quoted);
  });
});
