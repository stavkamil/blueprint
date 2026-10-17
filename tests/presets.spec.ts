// Proves every lint-catalog rule in SPEC-standards fires (config-presets acceptance criteria 1, 2 and 4):
// each case writes one small file into a fixture project, and the clean files must pass untouched.
import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { beforeAll, describe, expect, it } from "vitest";

const exec = promisify(execFile);
const root = fileURLToPath(new URL("..", import.meta.url));
const fixtureDir = join(root, "node_modules", ".cache", "presets-fixture-ts");

type Case = { readonly file: string; readonly code: string; readonly rule: string };

const cleanFiles: Readonly<Record<string, string>> = {
  "src/index.ts": [
    'import { getUser } from "./modules/user/get-user.ts";',
    'import { formatName } from "./utils/format-name.ts";',
    "",
    'process.stdout.write(formatName(getUser("u1").name));',
  ].join("\n"),
  "src/modules/user/get-user.ts": [
    "/** A signed-up user. */",
    "export type User = { readonly id: string; readonly name: string };",
    "",
    "/** Looks a user up by id; the fixture always finds one. */",
    'export const getUser = (id: string): User => ({ id, name: "Ada" });',
  ].join("\n"),
  "src/modules/user/get-user.spec.ts": [
    'import { describe, expect, it } from "vitest";',
    "",
    'import { getUser } from "./get-user.ts";',
    "",
    'describe("getUser", () => {',
    '  it("returns the user with the given id", () => {',
    '    expect(getUser("u1").id).toBe("u1");',
    "  });",
    "});",
  ].join("\n"),
  "src/utils/format-name.ts": [
    "/** Trims a display name so lists line up. */",
    "export const formatName = (name: string): string => name.trim();",
  ].join("\n"),
  "src/config/constants.ts": [
    "/** How many times a failed request is retried before giving up. */",
    "export const maxRetries = 5;",
  ].join("\n"),
};

const cases: readonly Case[] = [
  {
    file: "src/utils/default-export.ts",
    code: "/** One. */\nconst one = 1;\nexport default one;",
    rule: "no-restricted-syntax",
  },
  {
    file: "src/utils/barrel.ts",
    code: [
      'export { a } from "./a.ts";',
      'export { b } from "./b.ts";',
      'export { c } from "./c.ts";',
      'export { d } from "./d.ts";',
    ].join("\n"),
    rule: "barrel-files/avoid-barrel-files",
  },
  {
    file: "src/utils/re-export-all.ts",
    code: 'export * from "./a.ts";',
    rule: "barrel-files/avoid-re-export-all",
  },
  {
    file: "src/utils/BadName.ts",
    code: "/** One. */\nexport const one = (): number => 1;",
    rule: "check-file/filename-naming-convention",
  },
  {
    file: "src/utils/BadFolder/one.ts",
    code: "/** One. */\nexport const one = (): number => 1;",
    rule: "check-file/folder-naming-convention",
  },
  {
    file: "src/utils/shape.ts",
    code: "/** A shape. */\nexport interface Shape {\n  readonly size: number;\n}",
    rule: "@typescript-eslint/consistent-type-definitions",
  },
  {
    file: "src/utils/role.ts",
    code: '/** A role. */\nexport type Role = "admin" | "member";',
    rule: "no-restricted-syntax",
  },
  {
    file: "src/utils/any-value.ts",
    code: "/** Stringify. */\nexport const show = (value: any): string => String(value);",
    rule: "@typescript-eslint/no-explicit-any",
  },
  {
    file: "src/utils/first-item.ts",
    code: "/** First. */\nexport const first = (items: readonly string[]): string => items[0]!;",
    rule: "@typescript-eslint/no-non-null-assertion",
  },
  {
    file: "src/utils/no-return-type.ts",
    code: "/** Same. */\nexport const same = (n: number) => n;",
    rule: "@typescript-eslint/explicit-module-boundary-types",
  },
  {
    file: "src/utils/declared.ts",
    code: "/** One. */\nexport function one(): number {\n  return 1;\n}",
    rule: "func-style",
  },
  {
    file: "src/utils/user-id.ts",
    code: '/** Id. */\nexport const userID = "u1";',
    rule: "@typescript-eslint/naming-convention",
  },
  {
    file: "src/utils/flag.ts",
    code: "/** Flag. */\nexport const active = true;",
    rule: "@typescript-eslint/naming-convention",
  },
  {
    file: "src/utils/magic.ts",
    code: "/** Scale. */\nexport const scale = (n: number): number => n * 42;",
    rule: "@typescript-eslint/no-magic-numbers",
  },
  {
    file: "src/utils/throw-string.ts",
    code: '/** Fail. */\nexport const fail = (): never => {\n  throw "nope";\n};',
    rule: "@typescript-eslint/only-throw-error",
  },
  {
    file: "src/utils/then-chain.ts",
    code: "/** Load. */\nexport const load = async (): Promise<number> => Promise.resolve(1).then((n) => n);",
    rule: "no-restricted-syntax",
  },
  {
    file: "src/utils/mutate.ts",
    code: '/** Rename. */\nexport const rename = (item: { name: string }): void => {\n  item.name = "x";\n};',
    rule: "no-param-reassign",
  },
  {
    file: "src/utils/log.ts",
    code: '/** Log. */\nexport const log = (): void => {\n  console.log("x");\n};',
    rule: "no-console",
  },
  {
    file: "src/utils/undocumented.ts",
    code: "export const plain = (): number => 1;",
    rule: "jsdoc/require-jsdoc",
  },
  {
    file: "src/utils/typed-doc.ts",
    code: "/**\n * Doubles.\n * @param {number} n the count\n */\nexport const double = (n: number): number => n + n;",
    rule: "jsdoc/no-types",
  },
  {
    file: "src/utils/unsorted.ts",
    code: 'import { b } from "./b.ts";\nimport { a } from "./a.ts";\n\n/** Both. */\nexport const both = [a, b];',
    rule: "simple-import-sort/imports",
  },
  {
    file: "src/modules/cart/use-user.ts",
    code: 'import { getUser } from "../user/get-user.ts";\n\n/** Owner. */\nexport const owner = getUser("u1");',
    rule: "boundaries/dependencies",
  },
  {
    file: "src/utils/reach-into-module.ts",
    code: 'import { getUser } from "../modules/user/get-user.ts";\n\n/** Owner. */\nexport const owner = getUser("u1");',
    rule: "boundaries/dependencies",
  },
  {
    file: "src/utils/sum.test.ts",
    code: 'import { expect, it } from "vitest";\n\nit("adds", () => {\n  expect(1).toBe(1);\n});',
    rule: "vitest/consistent-test-filename",
  },
  {
    file: "src/utils/focused.spec.ts",
    code: 'import { expect, it } from "vitest";\n\nit.only("adds", () => {\n  expect(1).toBe(1);\n});',
    rule: "vitest/no-focused-tests",
  },
  {
    file: "src/utils/skipped.spec.ts",
    code: 'import { expect, it } from "vitest";\n\nit.skip("adds", () => {\n  expect(1).toBe(1);\n});',
    rule: "vitest/no-disabled-tests",
  },
];

const write = async (file: string, code: string): Promise<void> => {
  const target = join(fixtureDir, file);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${code}\n`);
};

// Runs a tool from node_modules/.bin and returns its stdout, whether it exits 0 or reports problems.
const stdoutOf = async (tool: string, args: readonly string[], cwd: string): Promise<string> => {
  try {
    const { stdout } = await exec(join(root, "node_modules", ".bin", tool), [...args], {
      cwd,
      maxBuffer: 10_000_000,
    });
    return stdout;
  } catch (error) {
    return error instanceof Error && "stdout" in error ? String(error.stdout) : "";
  }
};

let rulesByFile = new Map<string, readonly string[]>();

beforeAll(async () => {
  await rm(fixtureDir, { recursive: true, force: true });
  await write(
    "tsconfig.json",
    JSON.stringify({ extends: join(root, "tsconfig", "node.json"), include: ["src"] }),
  );
  for (const [file, code] of Object.entries(cleanFiles)) {
    await write(file, code);
  }
  for (const testCase of cases) {
    await write(testCase.file, testCase.code);
  }
  await write(
    "eslint.config.js",
    `export { ts as default } from ${JSON.stringify(join(root, "presets", "eslint", "index.js"))};`,
  );
  // Run ESLint the way a project does: as a command from the project folder, so resolvers find its tsconfig.
  const stdout = await stdoutOf("eslint", ["src", "--format", "json"], fixtureDir);
  const results = JSON.parse(stdout) as readonly {
    filePath: string;
    messages: readonly { ruleId: string | null; message: string }[];
  }[];
  rulesByFile = new Map(
    results.map((result) => [
      result.filePath.slice(fixtureDir.length + 1),
      result.messages.map((message) => message.ruleId ?? message.message),
    ]),
  );
}, 120_000);

describe("ts preset", () => {
  it.each(Object.keys(cleanFiles))("passes the clean file %s", (file) => {
    expect(rulesByFile.get(file)).toEqual([]);
  });

  it.each(cases)("flags $file with $rule", ({ file, rule }) => {
    expect(rulesByFile.get(file)).toContain(rule);
  });

  it("rejects enums at compile time (erasableSyntaxOnly)", async () => {
    const dir = join(fixtureDir, "..", "presets-fixture-enum");
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, "tsconfig.json"),
      JSON.stringify({ extends: join(root, "tsconfig", "node.json"), include: ["*.ts"] }),
    );
    await writeFile(join(dir, "status.ts"), "export enum Status {\n  Open,\n}\n");

    const output = await stdoutOf("tsc", ["-p", dir, "--noEmit"], root);

    expect(output).toContain("TS1294");
  }, 60_000);
});
