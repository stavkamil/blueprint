// Content tests for the coding-standards guides in standards/ (SPEC-standards acceptance criteria 1, 2, 3 and 6).
// Guides join requiredGuides as they're written; every check then applies to them.
import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { extractCodeBlocks } from "./support/code-blocks.ts";

const exec = promisify(execFile);
const root = fileURLToPath(new URL("..", import.meta.url));
const standardsDir = join(root, "standards");
const maxGuideLines = 100;

const requiredGuides: readonly string[] = [
  "typescript.md",
  "testing.md",
  "structure.md",
  "workflow.md",
  "react.md",
];

const allGuides = ["typescript.md", "testing.md", "structure.md", "workflow.md", "react.md"];

// Each guide-catalog rule, identified by a phrase only its own guide may contain (criterion 6).
const rulePhrases: Readonly<Record<string, readonly string[]>> = {
  "typescript.md": [
    "keyof typeof",
    "z.infer",
    "rethrow",
    "one main export",
    "@param",
    "every todo links an issue",
    "strings with meaning",
  ],
  "testing.md": [
    "arrange",
    "at the edges",
    "user-event",
    "factories",
    "snapshot",
    "msw",
    "playwright",
    "coverage",
  ],
  "structure.md": [
    "src/features/<name>",
    "src/modules/<name>",
    "never import each other",
    "colocate",
    "7 files",
  ],
  "workflow.md": [
    "one change per branch",
    "conventional commit",
    "how to revert",
    "written reason",
  ],
  "react.md": ['"use client"', "state ladder", "useeffect", "semantic html", "tailwind"],
};

// Lint already enforces these; a guide that mentions them is restating a lint rule (criterion 5's "no duplicates").
const lintOnlyPhrases = [
  "kebab-case",
  "barrel",
  "default export",
  "magic number",
  "console.log",
  ".then(",
  "react.fc",
  "non-null",
];

const negativeExample = /❌|^#{1,6}\s*(bad|wrong|don'?t|avoid|incorrect|anti-?pattern)\b/imu;

const readGuide = async (guide: string): Promise<string> =>
  readFile(join(standardsDir, guide), "utf8");

// Writes a guide's ts examples to their titled paths inside node_modules/.cache (so imports such as zod resolve)
// and typechecks them together with the ts preset's strict compiler options.
const typecheckExamples = async (guide: string, markdown: string): Promise<string> => {
  const blocks = extractCodeBlocks(markdown).filter((block) => block.language === "ts");
  if (blocks.length === 0) {
    return "";
  }
  const workDir = join(root, "node_modules", ".cache", "standards-examples", guide);
  await rm(workDir, { recursive: true, force: true });
  for (const block of blocks) {
    const file = join(workDir, block.title ?? `untitled-line-${String(block.line)}.ts`);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, `${block.code}\n`);
  }
  await writeFile(
    join(workDir, "tsconfig.json"),
    JSON.stringify({
      extends: join(root, "tsconfig", "node.json"),
      compilerOptions: { noEmit: true },
      include: ["**/*.ts"],
    }),
  );
  try {
    await exec(join(root, "node_modules", ".bin", "tsc"), ["-p", workDir]);
    return "";
  } catch (error) {
    return error instanceof Error && "stdout" in error ? String(error.stdout) : String(error);
  }
};

describe("standards guides", () => {
  it("names only known guides in the rule map", () => {
    expect(Object.keys(rulePhrases).sort()).toEqual([...allGuides].sort());
  });

  describe.each(requiredGuides)("%s", (guide) => {
    it("exists and stays under the line limit", async () => {
      const lineCount = (await readGuide(guide)).trimEnd().split("\n").length;

      expect(lineCount).toBeLessThan(maxGuideLines);
    });

    it("shows only target behavior, with no negative examples", async () => {
      expect(await readGuide(guide)).not.toMatch(negativeExample);
    });

    it("gives every ts/tsx example the path it would live at", async () => {
      const untitled = extractCodeBlocks(await readGuide(guide))
        .filter((block) => ["ts", "tsx"].includes(block.language) && block.title === undefined)
        .map((block) => `line ${String(block.line)}`);

      expect(untitled).toEqual([]);
    });

    it("has ts examples that typecheck under the strict tsconfig", async () => {
      expect(await typecheckExamples(guide, await readGuide(guide))).toBe("");
    }, 60_000);

    it("contains each of its rules", async () => {
      const text = (await readGuide(guide)).toLowerCase();
      const missing = (rulePhrases[guide] ?? []).filter((phrase) => !text.includes(phrase));

      expect(missing).toEqual([]);
    });

    it("keeps other guides' rules and lint-enforced rules out", async () => {
      const text = (await readGuide(guide)).toLowerCase();
      const foreign = Object.entries(rulePhrases)
        .filter(([owner]) => owner !== guide)
        .flatMap(([, phrases]) => phrases)
        .filter((phrase) => text.includes(phrase));
      const lintOnly = lintOnlyPhrases.filter((phrase) => text.includes(phrase));

      expect([...foreign, ...lintOnly]).toEqual([]);
    });
  });

  it("ends every workflow step with a checkable completion criterion", async () => {
    const steps = (await readGuide("workflow.md"))
      .split("\n")
      .filter((line) => /^\d+\.\s/u.test(line));
    const withoutCriterion = steps.filter((step) => !step.includes("Done when:"));

    expect(steps).toHaveLength(5);
    expect(withoutCriterion).toEqual([]);
  });
});

describe("AGENTS.md standards block", () => {
  const readBlock = async (): Promise<string> => readGuide("agents-block.md");

  it("points at every guide and at the review instructions", async () => {
    const block = await readBlock();
    const missing = allGuides.filter((guide) => !block.includes(`docs/standards/${guide}`));

    expect(missing).toEqual([]);
    expect(block).toContain("read REVIEW.md");
  });

  it("keeps the lint reminder on its own line, outside the pointer list", async () => {
    expect(await readBlock()).toMatch(/\n\nEverything else is enforced: run `pnpm lint`\.\n/u);
  });

  it("ends with a four-item Done means checklist", async () => {
    const doneMeans = (await readBlock()).split("## Done means")[1] ?? "";
    const items = doneMeans.split("\n").filter((line) => line.startsWith("- "));

    expect(items).toHaveLength(4);
  });

  it("marks exactly the React pointer as nextjs-only", async () => {
    const marked = (await readBlock())
      .split("\n")
      .filter((line) => line.includes("<!-- nextjs-only -->"));

    expect(marked).toHaveLength(1);
    expect(marked[0]).toContain("docs/standards/react.md");
  });
});

describe("blueprint's own AGENTS.md", () => {
  it("points at the guides that apply to a ts project and stays under 60 lines", async () => {
    const agents = await readFile(join(root, "AGENTS.md"), "utf8");
    const tsGuides = allGuides.filter((guide) => guide !== "react.md");
    const missing = tsGuides.filter((guide) => !agents.includes(`standards/${guide}`));

    expect(missing).toEqual([]);
    expect(agents.trimEnd().split("\n").length).toBeLessThan(60);
  });
});
