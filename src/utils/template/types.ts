import type { ProjectType } from "./project-type.ts";

/** Everything needed to render a project's files. The same options always render the same files. */
export type TemplateOptions = {
  /** Kebab-case; becomes the folder, package and repo name. */
  readonly projectName: string;
  /** One line, used in AGENTS.md, the README and package.json. */
  readonly description: string;
  readonly type: ProjectType;
  /** Adds release-please and the release workflow. */
  readonly release: boolean;
  /** The installed blueprint version; its major pins the CI callers to `@v<major>`. */
  readonly blueprintVersion: string;
  /** Version ranges for the dependencies the templates mark `from-blueprint`, by package name. */
  readonly versions: Readonly<Record<string, string>>;
  /** The pnpm version that ran `blueprint new`, recorded as `packageManager`. */
  readonly pnpmVersion: string;
};

/** Any value JSON can hold. */
export type JsonValue =
  string | number | boolean | null | readonly JsonValue[] | { readonly [key: string]: JsonValue };

/** A JSON object, such as a parsed package.json. */
export type JsonObject = { readonly [key: string]: JsonValue };
