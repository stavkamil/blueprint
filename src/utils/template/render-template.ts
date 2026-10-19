import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { fillPlaceholders } from "./fill-placeholders.ts";
import { formatJson } from "./format-json.ts";
import { mergePackageJson } from "./merge-package-json.ts";
import { ProjectType } from "./project-type.ts";
import { sortDependencies } from "./sort-dependencies.ts";
import type { JsonObject, JsonValue, TemplateOptions } from "./types.ts";
import { upsertMarkedBlock } from "./upsert-marked-block.ts";

const templatesDir = new URL("../../../templates/", import.meta.url);
const standardsDir = new URL("../../../standards/", import.meta.url);

/** Template files store dotfiles as `dot-<name>`, because npm drops some dotfiles (like .gitignore) from packages. */
const dotPrefix = "dot-";
/** Files that tools would load as live config inside blueprint (ESLint configs, package.json) end in `.tmpl`. */
const templateSuffix = ".tmpl";
/** A dependency version the templates take from blueprint's own package.json, so there's one place to bump it. */
const fromBlueprint = "from-blueprint";
const standardsBlockId = "blueprint-standards";
const versionedFields = ["dependencies", "devDependencies"];
const nextjsOnlyMarker = " <!-- nextjs-only -->";

const toProjectPath = (templatePath: string): string =>
  (templatePath.endsWith(templateSuffix)
    ? templatePath.slice(0, -templateSuffix.length)
    : templatePath
  )
    .split("/")
    .map((segment) =>
      segment.startsWith(dotPrefix) ? `.${segment.slice(dotPrefix.length)}` : segment,
    )
    .join("/");

const readLayer = async (layer: string): Promise<ReadonlyMap<string, string>> => {
  const layerDir = fileURLToPath(new URL(layer, templatesDir));
  const entries = await readdir(layerDir, { recursive: true, withFileTypes: true });
  const files = new Map<string, string>();
  for (const entry of entries.filter((candidate) => candidate.isFile())) {
    const absolute = join(entry.parentPath, entry.name);
    const templatePath = relative(layerDir, absolute).split(sep).join("/");
    files.set(toProjectPath(templatePath), await readFile(absolute, "utf8"));
  }
  return files;
};

const parseJsonObject = (text: string, source: string): JsonObject => {
  const value: unknown = JSON.parse(text);
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${source} must contain a JSON object`);
  }
  return value as JsonObject;
};

const resolveVersions = (
  dependencies: JsonValue,
  versions: TemplateOptions["versions"],
): JsonValue => {
  if (typeof dependencies !== "object" || dependencies === null || Array.isArray(dependencies)) {
    return dependencies;
  }
  return Object.fromEntries(
    Object.entries(dependencies).map(([name, range]) => {
      if (range !== fromBlueprint) {
        return [name, range];
      }
      const version = versions[name];
      if (version === undefined) {
        throw new Error(`No version for ${name}; add it to blueprint's package.json`);
      }
      return [name, version];
    }),
  );
};

const renderPackageJson = (parts: readonly JsonObject[], options: TemplateOptions): string => {
  const merged = mergePackageJson(
    { name: options.projectName, description: options.description },
    ...parts,
    { packageManager: `pnpm@${options.pnpmVersion}` },
  );
  const resolved = Object.fromEntries(
    Object.entries(merged).map(([key, value]) => [
      key,
      versionedFields.includes(key) ? resolveVersions(value, options.versions) : value,
    ]),
  );
  return formatJson(sortDependencies(resolved));
};

const renderStandardsBlock = async (type: TemplateOptions["type"]): Promise<string> => {
  const block = await readFile(new URL("agents-block.md", standardsDir), "utf8");
  return block
    .split("\n")
    .filter((line) => type === ProjectType.Nextjs || !line.endsWith(nextjsOnlyMarker))
    .map((line) => line.replace(nextjsOnlyMarker, ""))
    .join("\n");
};

const readGuides = async (type: TemplateOptions["type"]): Promise<ReadonlyMap<string, string>> => {
  const names = (await readdir(standardsDir)).filter(
    (name) =>
      name.endsWith(".md") &&
      name !== "agents-block.md" &&
      (type === ProjectType.Nextjs || name !== "react.md"),
  );
  const guides = new Map<string, string>();
  for (const name of names) {
    guides.set(`docs/standards/${name}`, await readFile(new URL(name, standardsDir), "utf8"));
  }
  return guides;
};

/**
 * Renders every file blueprint writes into a new project, by path. For nextjs these are the files that go on top of
 * create-next-app's output. Reads only blueprint's own templates and standards: no clock, network or randomness.
 * @param options the project to render
 */
export const renderTemplate = async (
  options: TemplateOptions,
): Promise<ReadonlyMap<string, string>> => {
  const [major] = options.blueprintVersion.split(".");
  const values = {
    projectName: options.projectName,
    description: options.description,
    descriptionLiteral: JSON.stringify(options.description),
    blueprintVersion: options.blueprintVersion,
    blueprintMajor: major ?? options.blueprintVersion,
    importExtension: options.type === ProjectType.Ts ? ".ts" : "",
  };
  const layers = ["base", options.type, ...(options.release ? ["release"] : [])];
  const files = new Map<string, string>();
  const packageParts: JsonObject[] = [];
  for (const layer of layers) {
    for (const [path, content] of await readLayer(layer)) {
      if (path === "package.json") {
        packageParts.push(parseJsonObject(content, `templates/${layer}/package.json.tmpl`));
      } else {
        files.set(path, fillPlaceholders(content, values));
      }
    }
  }
  files.set("package.json", renderPackageJson(packageParts, options));
  files.set(
    "AGENTS.md",
    upsertMarkedBlock(
      files.get("AGENTS.md") ?? "",
      standardsBlockId,
      await renderStandardsBlock(options.type),
    ),
  );
  for (const [path, content] of await readGuides(options.type)) {
    files.set(path, content);
  }
  return new Map([...files].sort(([left], [right]) => left.localeCompare(right)));
};
