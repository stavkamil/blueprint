// Proves every lint-catalog rule in SPEC-standards fires (config-presets acceptance criteria 1–4 and 9):
// each case writes one small file into a fixture project; clean files and the standards guides' examples must pass.
import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { beforeAll, describe, expect, it } from "vitest";

import { extractCodeBlocks } from "./support/code-blocks.ts";

const exec = promisify(execFile);
const root = fileURLToPath(new URL("..", import.meta.url));
const cacheDir = join(root, "node_modules", ".cache");
const fixtureDir = join(cacheDir, "presets-fixture-ts");
const nextFixtureDir = join(cacheDir, "presets-fixture-nextjs");

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

const write = async (file: string, code: string, dir = fixtureDir): Promise<void> => {
  const target = join(dir, file);
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

type LintResult = {
  readonly filePath: string;
  readonly messages: readonly { readonly ruleId: string | null; readonly message: string }[];
};

// Runs ESLint the way a project does: as a command from the project folder, so resolvers find its tsconfig.
const lintFixture = async (dir: string): Promise<Map<string, readonly string[]>> => {
  const results = JSON.parse(
    await stdoutOf("eslint", ["src", "--format", "json"], dir),
  ) as readonly LintResult[];
  return new Map(
    results.map((result) => [
      result.filePath.slice(dir.length + 1),
      result.messages.map((message) => message.ruleId ?? message.message),
    ]),
  );
};

// Code examples from the standards guides, keyed by the path each declares (SPEC-standards criterion 3).
const guideExamples = async (language: string): Promise<Readonly<Record<string, string>>> => {
  const standardsDir = join(root, "standards");
  const guides = (await readdir(standardsDir)).filter((file) => file.endsWith(".md"));
  const examples: Record<string, string> = {};
  for (const guide of guides) {
    for (const block of extractCodeBlocks(await readFile(join(standardsDir, guide), "utf8"))) {
      if (block.language === language && block.title !== undefined) {
        examples[block.title] = block.code;
      }
    }
  }
  return examples;
};

const presetPath = JSON.stringify(join(root, "presets", "eslint", "index.js"));

let rulesByFile = new Map<string, readonly string[]>();
let tsExamples: Readonly<Record<string, string>> = {};

beforeAll(async () => {
  await rm(fixtureDir, { recursive: true, force: true });
  tsExamples = await guideExamples("ts");
  await write(
    "tsconfig.json",
    JSON.stringify({ extends: join(root, "tsconfig", "node.json"), include: ["src"] }),
  );
  for (const [file, code] of [...Object.entries(cleanFiles), ...Object.entries(tsExamples)]) {
    await write(file, code);
  }
  for (const testCase of cases) {
    await write(testCase.file, testCase.code);
  }
  await write("eslint.config.js", `export { ts as default } from ${presetPath};`);
  rulesByFile = await lintFixture(fixtureDir);
}, 120_000);

describe("ts preset", () => {
  it.each(Object.keys(cleanFiles))("passes the clean file %s", (file) => {
    expect(rulesByFile.get(file)).toEqual([]);
  });

  it.each(cases)("flags $file with $rule", ({ file, rule }) => {
    expect(rulesByFile.get(file)).toContain(rule);
  });

  it("passes every ts example from the standards guides", () => {
    const failing = Object.keys(tsExamples)
      .map((file) => [file, rulesByFile.get(file)] as const)
      .filter(([, rules]) => rules === undefined || rules.length > 0);

    expect(Object.keys(tsExamples).length).toBeGreaterThan(0);
    expect(failing).toEqual([]);
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

const nextCleanFiles: Readonly<Record<string, string>> = {
  "src/app/page.tsx": [
    'import { CartButton } from "@/features/cart/components/cart-button";',
    "",
    'const Home = () => <CartButton label="Add" />;',
    "",
    "export default Home;",
  ].join("\n"),
  "src/app/(shop)/products/[id]/page.tsx": [
    "const Product = () => <main>Product</main>;",
    "",
    "export default Product;",
  ].join("\n"),
  "src/features/cart/components/cart-button.tsx": [
    '"use client";',
    "",
    'import { useState } from "react";',
    "",
    'import { formatCount } from "@/utils/format-count";',
    "",
    "/** Props for the add-to-cart button. */",
    "export type CartButtonProps = { readonly label: string };",
    "",
    "/** Adds the product to the cart and shows how many were added. */",
    "export const CartButton = ({ label }: CartButtonProps) => {",
    "  const [count, setCount] = useState(0);",
    "  const handleClick = () => {",
    "    setCount((current) => current + 1);",
    "  };",
    "  return (",
    '    <button type="button" onClick={handleClick}>',
    "      {label} {formatCount(count)}",
    "    </button>",
    "  );",
    "};",
  ].join("\n"),
  "src/utils/format-count.ts": [
    "/** Shows a count in parentheses, or nothing for zero. */",
    'export const formatCount = (count: number): string => (count === 0 ? "" : `(${String(count)})`);',
  ].join("\n"),
};

const nextCases: readonly Case[] = [
  {
    file: "src/components/two-components.tsx",
    code: "/** A. */\nexport const First = () => <p>a</p>;\n\n/** B. */\nexport const Second = () => <p>b</p>;",
    rule: "react/no-multi-comp",
  },
  {
    file: "src/components/fc-type.tsx",
    code: 'import type { FC } from "react";\n\n/** Title. */\nexport const Title: FC = () => <h1>t</h1>;',
    rule: "@typescript-eslint/no-restricted-types",
  },
  {
    file: "src/components/props-object.tsx",
    code: "/** Name. */\nexport const Name = (props: { readonly name: string }) => <p>{props.name}</p>;",
    rule: "react/destructuring-assignment",
  },
  {
    file: "src/components/handler-name.tsx",
    code: '/** Save. */\nexport const Save = () => {\n  const save = () => undefined;\n  return <button type="button" onClick={save}>Save</button>;\n};',
    rule: "react/jsx-handler-names",
  },
  {
    file: "src/components/clickable-div.tsx",
    code: "/** Box. */\nexport const Box = () => {\n  const handleClick = () => undefined;\n  return <div onClick={handleClick}>box</div>;\n};",
    rule: "jsx-a11y/click-events-have-key-events",
  },
  {
    file: "src/components/conditional-hook.tsx",
    code: 'import { useState } from "react";\n\n/** Toggle. */\nexport const Toggle = ({ isOn }: { readonly isOn: boolean }) => {\n  if (isOn) {\n    useState(0);\n  }\n  return <p>t</p>;\n};',
    rule: "react-hooks/rules-of-hooks",
  },
  {
    file: "src/features/cart/components/deep-import.tsx",
    code: 'import { formatCount } from "../../../utils/format-count";\n\n/** Count. */\nexport const Count = () => <p>{formatCount(1)}</p>;',
    rule: "no-restricted-imports",
  },
  {
    file: "src/features/checkout/components/uses-cart.tsx",
    code: 'import { CartButton } from "@/features/cart/components/cart-button";\n\n/** Checkout. */\nexport const Checkout = () => <CartButton label="Buy" />;',
    rule: "boundaries/dependencies",
  },
];

describe("nextjs preset", () => {
  let nextRules = new Map<string, readonly string[]>();
  let tsxExamples: Readonly<Record<string, string>> = {};

  beforeAll(async () => {
    await rm(nextFixtureDir, { recursive: true, force: true });
    tsxExamples = await guideExamples("tsx");
    await write(
      "tsconfig.json",
      JSON.stringify({
        extends: join(root, "tsconfig", "nextjs.json"),
        compilerOptions: { paths: { "@/*": ["./src/*"] } },
        include: ["src"],
      }),
      nextFixtureDir,
    );
    const files = [
      ...Object.entries(nextCleanFiles),
      ...Object.entries(tsxExamples),
      ...nextCases.map((testCase) => [testCase.file, testCase.code] as const),
    ];
    for (const [file, code] of files) {
      await write(file, code, nextFixtureDir);
    }
    await write(
      "eslint.config.js",
      [
        'import next from "eslint-config-next/core-web-vitals";',
        `import { nextjs } from ${presetPath};`,
        "",
        "export default [...next, ...nextjs];",
      ].join("\n"),
      nextFixtureDir,
    );
    nextRules = await lintFixture(nextFixtureDir);
  }, 180_000);

  it.each(Object.keys(nextCleanFiles))("passes the clean file %s", (file) => {
    expect(nextRules.get(file)).toEqual([]);
  });

  it.each(nextCases)("flags $file with $rule", ({ file, rule }) => {
    expect(nextRules.get(file)).toContain(rule);
  });

  it("passes every tsx example from the standards guides", () => {
    const failing = Object.keys(tsxExamples)
      .map((file) => [file, nextRules.get(file)] as const)
      .filter(([, rules]) => rules === undefined || rules.length > 0);

    expect(Object.keys(tsxExamples).length).toBeGreaterThan(0);
    expect(failing).toEqual([]);
  });

  it("typechecks the clean files and the tsx examples", async () => {
    const output = await stdoutOf("tsc", ["-p", nextFixtureDir, "--noEmit"], root);
    const relevant = output
      .split("\n")
      .filter((line) =>
        [...Object.keys(nextCleanFiles), ...Object.keys(tsxExamples)].some((file) =>
          line.includes(file),
        ),
      );

    expect(relevant).toEqual([]);
  }, 120_000);
});

describe("lefthook preset", () => {
  it("gives a project that extends it the format, lint, secrets and verify hooks", async () => {
    const dir = join(cacheDir, "presets-fixture-lefthook");
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, "lefthook.yml"),
      `extends:\n  - ${join(root, "presets", "lefthook", "base.yml")}\n`,
    );

    const merged = await stdoutOf("lefthook", ["dump"], dir);

    expect(merged).toMatch(/pre-commit:[\s\S]*format:[\s\S]*lint:[\s\S]*secrets:/u);
    expect(merged).toMatch(/pre-push:[\s\S]*verify:/u);
  }, 60_000);
});
