import { describe, expect, it } from "vitest";

import { formatJson } from "./format-json.ts";

describe("formatJson", () => {
  it("indents with two spaces and ends with a newline", () => {
    const text = formatJson({ name: "demo", scripts: { test: "vitest" } });

    expect(text).toBe('{\n  "name": "demo",\n  "scripts": {\n    "test": "vitest"\n  }\n}\n');
  });
});
