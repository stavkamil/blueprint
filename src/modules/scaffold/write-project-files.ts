import { chmod, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/** Shell scripts (the Claude hooks) must stay executable. */
const executableMode = 0o755;

/**
 * Writes rendered files into the project folder, creating parent folders as needed.
 * @param dir the project folder
 * @param files file contents by project-relative path
 */
export const writeProjectFiles = async (
  dir: string,
  files: ReadonlyMap<string, string>,
): Promise<void> => {
  for (const [path, content] of files) {
    const target = join(dir, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
    if (path.endsWith(".sh")) {
      await chmod(target, executableMode);
    }
  }
};
