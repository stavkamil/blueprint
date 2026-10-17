import { describe, expect, it } from "vitest";

import { extractCodeBlocks } from "./code-blocks.ts";

describe("extractCodeBlocks", () => {
  it("returns each fenced block with its language, title and code", () => {
    const markdown = [
      "# Guide",
      "",
      '```ts title="src/utils/sum.ts"',
      "export const sum = (a: number, b: number): number => a + b;",
      "```",
      "",
      "```bash",
      "pnpm test",
      "```",
    ].join("\n");

    const blocks = extractCodeBlocks(markdown);

    expect(blocks).toEqual([
      {
        language: "ts",
        title: "src/utils/sum.ts",
        code: "export const sum = (a: number, b: number): number => a + b;",
        line: 3,
      },
      { language: "bash", title: undefined, code: "pnpm test", line: 7 },
    ]);
  });

  it("keeps blank lines inside a block", () => {
    const markdown = ["```ts", "const a = 1;", "", "const b = 2;", "```"].join("\n");

    const [block] = extractCodeBlocks(markdown);

    expect(block?.code).toBe("const a = 1;\n\nconst b = 2;");
  });

  it("returns nothing for a document without code blocks", () => {
    expect(extractCodeBlocks("Just prose.")).toEqual([]);
  });
});
