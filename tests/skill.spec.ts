// Guards the /new-project skill (SPEC-new-project-skill criteria 1, 4 and 6): user-invoked, short, every step ends
// with a completion criterion, and its command only uses flags the CLI has.
import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { runNew } from "../src/commands/new.ts";
import { extractCodeBlocks } from "./support/code-blocks.ts";

const skillUrl = new URL("../skill/new-project/SKILL.md", import.meta.url);
const maxLines = 80;
const stepNames = ["Gather", "Confirm", "Create", "Report"];

const readSkill = (): Promise<string> => readFile(skillUrl, "utf8");

const readNewHelp = async (): Promise<string> => {
  const lines: string[] = [];
  const record = (line: string): void => {
    lines.push(line);
  };
  await runNew(["--help"], { stdout: record, stderr: record });
  return lines.join("\n");
};

describe("the /new-project skill", () => {
  it("is user-invoked, with a one-line description", async () => {
    const skill = await readSkill();

    const frontmatter = /^---\n([\s\S]*?)\n---\n/u.exec(skill)?.[1] ?? "";

    expect(frontmatter).toMatch(/^name: new-project$/mu);
    expect(frontmatter).toMatch(/^description: .+$/mu);
    expect(frontmatter).toMatch(/^disable-model-invocation: true$/mu);
  });

  it(`stays under ${String(maxLines)} lines`, async () => {
    const skill = await readSkill();

    expect(skill.trimEnd().split("\n").length).toBeLessThan(maxLines);
  });

  it("ends each of its four steps with a completion criterion", async () => {
    const skill = await readSkill();

    const sections = skill.split(/^## /mu).slice(1);

    expect(sections.map((section) => section.split("\n")[0])).toEqual(
      stepNames.map((name, index) => `${String(index + 1)}. ${name}`),
    );
    for (const section of sections) {
      expect(section.trimEnd().split("\n").at(-1)).toMatch(/^Done when: /u);
    }
  });

  it("only uses flags blueprint new accepts", async () => {
    const skill = await readSkill();
    const help = await readNewHelp();

    const commands = extractCodeBlocks(skill).map((block) => block.code);
    const flags = [...skill.matchAll(/`(--[a-z-]+)`/gu)].map((match) => match[1] ?? "");
    const commandFlags = commands.flatMap((code) => code.match(/--[a-z-]+/gu) ?? []);

    expect(commands).toHaveLength(1);
    for (const flag of [...commandFlags, ...flags]) {
      expect(help).toContain(flag);
    }
  });
});
