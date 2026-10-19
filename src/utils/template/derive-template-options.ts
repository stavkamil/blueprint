import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

import { ProjectType } from "./project-type.ts";
import type { TemplateOptions } from "./types.ts";

/** The project options a folder records about itself. */
export type DerivedOptions = {
  readonly projectName: TemplateOptions["projectName"];
  readonly description: TemplateOptions["description"];
  readonly type: TemplateOptions["type"];
  readonly release: TemplateOptions["release"];
};

const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const stringField = (pkg: object, key: string): string | undefined => {
  const value = (pkg as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
};

/**
 * Reads a project's options back from its files, so `--resume` and doctor never have to ask again: name and
 * description from package.json, nextjs when `next` is a dependency, release when release-please is configured.
 * Returns undefined when the folder has no readable package.json.
 * @param projectDir the project folder
 */
export const deriveTemplateOptions = async (
  projectDir: string,
): Promise<DerivedOptions | undefined> => {
  const text = await readFile(join(projectDir, "package.json"), "utf8").catch(() => undefined);
  const pkg: unknown = text === undefined ? undefined : JSON.parse(text);
  if (typeof pkg !== "object" || pkg === null) {
    return undefined;
  }
  const projectName = stringField(pkg, "name");
  if (projectName === undefined) {
    return undefined;
  }
  const dependencies =
    (pkg as { readonly dependencies?: Record<string, unknown> }).dependencies ?? {};
  return {
    projectName,
    description: stringField(pkg, "description") ?? "",
    type: "next" in dependencies ? ProjectType.Nextjs : ProjectType.Ts,
    release: await exists(join(projectDir, "release-please-config.json")),
  };
};
