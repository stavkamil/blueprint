import { readFile } from "node:fs/promises";

import { BlueprintError } from "./errors.ts";

/** Reads blueprint's own version so `--version` and generated files always match the installed package. */
export const readPackageVersion = async (packageJsonUrl: URL): Promise<string> => {
  const pkg: unknown = JSON.parse(await readFile(packageJsonUrl, "utf8"));
  if (typeof pkg !== "object" || pkg === null || !("version" in pkg) || typeof pkg.version !== "string") {
    throw new BlueprintError(
      "Could not read the blueprint version.",
      "Reinstall the package: pnpm dlx @stavkamil/blueprint@latest --version",
    );
  }
  return pkg.version;
};
