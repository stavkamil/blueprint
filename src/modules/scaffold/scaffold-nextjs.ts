import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";

import { formatJson } from "../../utils/template/format-json.ts";
import { mergePackageJson } from "../../utils/template/merge-package-json.ts";
import { sortDependencies } from "../../utils/template/sort-dependencies.ts";
import type { JsonObject } from "../../utils/template/types.ts";
import { createNextAppMajor } from "./constants.ts";
import type { Problem, StepContext } from "./types.ts";
import { writeProjectFiles } from "./write-project-files.ts";

/** Every option is explicit, so preferences create-next-app saved on this machine can't change the result. */
const createNextAppFlags = [
  "--ts",
  "--tailwind",
  "--eslint",
  "--no-react-compiler",
  "--app",
  "--src-dir",
  "--cache-components",
  "--import-alias",
  "@/*",
  "--use-pnpm",
  "--agents-md",
  "--no-agent-feedback",
  "--skip-install",
  "--disable-git",
  "--yes",
];

const readJsonObject = async (path: string): Promise<JsonObject> =>
  JSON.parse(await readFile(path, "utf8")) as JsonObject;

/**
 * Runs create-next-app, then lays blueprint's files on top: package.json is merged, blueprint's AGENTS.md goes
 * above Next.js's managed block, and Next's ESLint config is replaced by blueprint's.
 * @param context the step context
 * @param files the rendered nextjs overlay
 */
export const scaffoldNextjs = async (
  { options, dir, run }: StepContext,
  files: ReadonlyMap<string, string>,
): Promise<Problem | undefined> => {
  const { projectName } = options.template;
  const created = await run(
    "pnpm",
    ["create", `next-app@${String(createNextAppMajor)}`, projectName, ...createNextAppFlags],
    { cwd: options.parentDir },
  );
  if (created.exitCode !== 0) {
    return {
      message: "create-next-app failed.",
      hint: `Check your network connection, then run blueprint new again. The folder ${dir} is kept for inspection.`,
      output: `${created.stdout}${created.stderr}`,
    };
  }

  const nextPackageJson = await readJsonObject(join(dir, "package.json"));
  const nextAgents = await readFile(join(dir, "AGENTS.md"), "utf8");
  const blueprintPackageJson = JSON.parse(files.get("package.json") ?? "{}") as JsonObject;
  const packageJson = mergePackageJson(nextPackageJson, blueprintPackageJson);
  const overlay = new Map(files);
  overlay.set("package.json", formatJson(sortDependencies(packageJson)));
  overlay.set("AGENTS.md", `${files.get("AGENTS.md") ?? ""}\n${nextAgents}`);
  await rm(join(dir, "eslint.config.mjs"), { force: true });
  await writeProjectFiles(dir, overlay);
  return undefined;
};
