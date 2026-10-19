import { jsonIndent } from "./constants.ts";

/**
 * Formats JSON the way Prettier would write it, so generated files pass `prettier --check` untouched.
 * @param value the value to write
 */
export const formatJson = (value: unknown): string =>
  `${JSON.stringify(value, undefined, jsonIndent)}\n`;
