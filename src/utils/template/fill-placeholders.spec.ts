import { describe, expect, it } from "vitest";

import { fillPlaceholders } from "./fill-placeholders.ts";

describe("fillPlaceholders", () => {
  it("replaces every known placeholder", () => {
    const text = "# {{name}}\n\n{{name}} does {{what}}.";

    const filled = fillPlaceholders(text, { name: "demo", what: "things" });

    expect(filled).toBe("# demo\n\ndemo does things.");
  });

  it("leaves unknown placeholders and GitHub expressions untouched", () => {
    const text = "{{unknown}} ${{ github.ref }}";

    const filled = fillPlaceholders(text, { name: "demo" });

    expect(filled).toBe(text);
  });
});
