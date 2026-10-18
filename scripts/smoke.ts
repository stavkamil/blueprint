// Packs blueprint, installs the tarball into an empty folder, and runs the installed CLI:
// proves the published package works, not just the source tree.
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const root = new URL("..", import.meta.url).pathname;

const fail = (message: string): never => {
  console.error(`Smoke test failed: ${message}`);
  process.exit(1);
};

const workDir = await mkdtemp(join(tmpdir(), "blueprint-smoke-"));
try {
  const { stdout: packOutput } = await exec("pnpm", ["pack", "--pack-destination", workDir], {
    cwd: root,
  });
  const tarball = packOutput.trim().split("\n").at(-1) ?? fail("pnpm pack printed no tarball path");

  const { stdout: listing } = await exec("tar", ["-tzf", tarball]);
  const files = listing.trim().split("\n");
  const guides = ["typescript", "testing", "structure", "workflow", "react", "agents-block"];
  const required = [
    "package/package.json",
    "package/dist/index.js",
    ...guides.map((guide) => `package/standards/${guide}.md`),
    "package/presets/eslint/index.js",
    "package/presets/prettier/index.js",
    "package/presets/lefthook/base.yml",
    "package/tsconfig/node.json",
    "package/tsconfig/nextjs.json",
  ];
  const missing = required.filter((file) => !files.includes(file));
  if (missing.length > 0) {
    fail(`tarball is missing ${missing.join(", ")}`);
  }
  const unexpected = files.filter(
    (file) => file.startsWith("package/src/") || file.includes(".spec."),
  );
  if (unexpected.length > 0) {
    fail(`tarball contains source or test files: ${unexpected.join(", ")}`);
  }

  const installDir = join(workDir, "install");
  await exec("npm", ["install", "--no-audit", "--no-fund", "--prefix", installDir, tarball]);
  const { stdout: installedVersion } = await exec(
    join(installDir, "node_modules", ".bin", "blueprint"),
    ["--version"],
  );

  const pkg: unknown = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const expected =
    typeof pkg === "object" && pkg !== null && "version" in pkg && typeof pkg.version === "string"
      ? pkg.version
      : fail("package.json has no version");
  if (installedVersion.trim() !== expected) {
    fail(`installed CLI printed '${installedVersion.trim()}', expected '${expected}'`);
  }

  process.stdout.write(
    `Smoke test passed: blueprint ${expected} installs and runs from the tarball.\n`,
  );
} finally {
  await rm(workDir, { recursive: true, force: true });
}
