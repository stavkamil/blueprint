import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { RunCommand } from "../../lib/run-command.ts";
import { ProjectType } from "../../utils/template/project-type.ts";
import { scaffoldNextjs } from "./scaffold-nextjs.ts";
import { makeScaffoldOptions } from "./testing/make-scaffold-options.ts";

const nextBlock =
  "<!-- BEGIN:nextjs-agent-rules -->\n\n## This is NOT the Next.js you know\n\n<!-- END:nextjs-agent-rules -->\n";

/** Stands in for create-next-app: writes the files it would create. */
const fakeCreateNextApp =
  (dir: string, calls: string[]): RunCommand =>
  async (command, args) => {
    calls.push([command, ...args].join(" "));
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, "package.json"),
      JSON.stringify({
        name: "demo",
        scripts: { dev: "next dev", lint: "eslint" },
        devDependencies: { typescript: "^5", "eslint-config-next": "16.4.2" },
      }),
    );
    await writeFile(join(dir, "AGENTS.md"), nextBlock);
    await writeFile(join(dir, "eslint.config.mjs"), "export default [];\n");
    return { exitCode: 0, stdout: "", stderr: "" };
  };

const overlay = new Map([
  [
    "AGENTS.md",
    "# demo\n\n<!-- BEGIN:blueprint-standards -->\n\n## Standards\n\n<!-- END:blueprint-standards -->\n",
  ],
  [
    "package.json",
    JSON.stringify({
      scripts: { lint: "eslint . && prettier --check ." },
      devDependencies: { typescript: "~6.0.3" },
    }),
  ],
  ["eslint.config.js", "export default [];\n"],
]);

const setUp = async (): Promise<{
  readonly dir: string;
  readonly calls: string[];
  readonly problem: Awaited<ReturnType<typeof scaffoldNextjs>>;
}> => {
  const options = await makeScaffoldOptions();
  const nextOptions = { ...options, template: { ...options.template, type: ProjectType.Nextjs } };
  const dir = join(options.parentDir, "demo");
  const calls: string[] = [];
  const problem = await scaffoldNextjs(
    { options: nextOptions, dir, run: fakeCreateNextApp(dir, calls) },
    overlay,
  );
  return { dir, calls, problem };
};

describe("scaffoldNextjs", () => {
  it("runs create-next-app with every option explicit", async () => {
    const { calls, problem } = await setUp();

    expect(problem).toBeUndefined();
    expect(calls).toEqual([
      "pnpm create next-app@16 demo --ts --tailwind --eslint --no-react-compiler --app --src-dir --cache-components --import-alias @/* --use-pnpm --agents-md --no-agent-feedback --skip-install --disable-git --yes",
    ]);
  });

  it("merges package.json, with blueprint's scripts and versions winning", async () => {
    const { dir } = await setUp();

    const pkg: unknown = JSON.parse(await readFile(join(dir, "package.json"), "utf8"));

    expect(pkg).toEqual({
      name: "demo",
      scripts: { dev: "next dev", lint: "eslint . && prettier --check ." },
      devDependencies: { typescript: "~6.0.3", "eslint-config-next": "16.4.2" },
    });
  });

  it("puts blueprint's AGENTS.md above Next.js's managed block, unchanged", async () => {
    const { dir } = await setUp();

    const agents = await readFile(join(dir, "AGENTS.md"), "utf8");

    expect(agents.startsWith("# demo\n")).toBe(true);
    expect(agents.endsWith(`\n${nextBlock}`)).toBe(true);
  });

  it("replaces Next's ESLint config with blueprint's", async () => {
    const { dir } = await setUp();

    const removed = access(join(dir, "eslint.config.mjs"));

    await expect(removed).rejects.toThrow();
    await access(join(dir, "eslint.config.js"));
  });

  it("reports a failed create-next-app with its output", async () => {
    const options = await makeScaffoldOptions();
    const fail: RunCommand = () =>
      Promise.resolve({ exitCode: 1, stdout: "", stderr: "ENOTFOUND registry.npmjs.org" });

    const problem = await scaffoldNextjs(
      { options, dir: join(options.parentDir, "demo"), run: fail },
      overlay,
    );

    expect(problem?.message).toBe("create-next-app failed.");
    expect(problem?.output).toBe("ENOTFOUND registry.npmjs.org");
  });
});
