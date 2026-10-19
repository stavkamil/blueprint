import { CheckStatus, type DoctorResult } from "./types.ts";

const plural = (count: number, word: string): string =>
  `${String(count)} ${word}${count === 1 ? "" : "s"}`;

/**
 * Turns a doctor result into the lines a person reads: one line when all is well, otherwise each problem with why it
 * matters and the exact next step.
 * @param result the doctor run
 */
export const formatDoctorReport = (result: DoctorResult): readonly string[] => {
  if (result.blocked !== undefined) {
    return [
      `blueprint doctor couldn't run: ${result.blocked.title}`,
      `  ${result.blocked.why}`,
      `  → ${result.blocked.action}`,
    ];
  }
  const fixedLines = result.fixed.map((name) => `fixed: ${name}`);
  const scopeNote = result.isLocalOnly ? " (no GitHub remote, so local checks only)" : "";
  const failures = result.checks.filter((check) => check.status === CheckStatus.Fail);
  if (failures.length === 0) {
    return [...fixedLines, `blueprint doctor: all checks passed${scopeNote}`];
  }
  return [
    ...fixedLines,
    `blueprint doctor: ${plural(failures.length, "problem")}${scopeNote}`,
    ...failures.flatMap((failure) => [
      "",
      `✗ ${failure.title ?? failure.name}`,
      `  ${failure.why ?? ""}`,
      `  → ${failure.action ?? "blueprint doctor --fix"}`,
    ]),
  ];
};
