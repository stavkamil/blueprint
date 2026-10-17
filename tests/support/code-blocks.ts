/** One fenced code block from a Markdown document; `line` is the 1-based line of its opening fence. */
export type CodeBlock = {
  readonly language: string;
  readonly title: string | undefined;
  readonly code: string;
  readonly line: number;
};

const openingFence = /^```(\S*)(?:\s+title="([^"]+)")?\s*$/u;
const closingFence = /^```\s*$/u;

/** Extracts fenced code blocks so the standards tests can check every example the guides show. */
export const extractCodeBlocks = (markdown: string): readonly CodeBlock[] => {
  const lines = markdown.split("\n");
  const blocks: CodeBlock[] = [];
  let index = 0;
  while (index < lines.length) {
    const opening = openingFence.exec(lines[index] ?? "");
    if (opening === null) {
      index += 1;
      continue;
    }
    const start = index;
    const body: string[] = [];
    index += 1;
    while (index < lines.length && !closingFence.test(lines[index] ?? "")) {
      body.push(lines[index] ?? "");
      index += 1;
    }
    blocks.push({
      language: opening[1] ?? "",
      title: opening[2],
      code: body.join("\n"),
      line: start + 1,
    });
    index += 1;
  }
  return blocks;
};
