import { describe, expect, it } from "vitest";

import { formatDoctorReport } from "./format-doctor-report.ts";
import type { DoctorResult } from "./types.ts";

const makeResult = (overrides: Partial<DoctorResult> = {}): DoctorResult => ({
  ok: true,
  isLocalOnly: false,
  checks: [{ id: "repo.merge", name: "Merge settings", status: "pass" }],
  fixed: [],
  ...overrides,
});

describe("formatDoctorReport", () => {
  it("prints one line when everything passes", () => {
    const lines = formatDoctorReport(makeResult());

    expect(lines).toEqual(["blueprint doctor: all checks passed"]);
  });

  it("says when only local checks ran", () => {
    const lines = formatDoctorReport(makeResult({ isLocalOnly: true }));

    expect(lines).toEqual([
      "blueprint doctor: all checks passed (no GitHub remote, so local checks only)",
    ]);
  });

  it("lists what --fix repaired before the result", () => {
    const lines = formatDoctorReport(makeResult({ fixed: ["Merge settings"] }));

    expect(lines).toEqual(["fixed: Merge settings", "blueprint doctor: all checks passed"]);
  });

  it("shows each problem with why it matters and the exact next step", () => {
    const result = makeResult({
      ok: false,
      checks: [
        {
          id: "repo.ruleset",
          name: "Ruleset blueprint-main",
          status: "fail",
          title: "The ruleset on main is missing or out of date",
          why: "Agents could push to main.",
          action: "blueprint doctor --fix",
        },
      ],
    });

    const lines = formatDoctorReport(result);

    expect(lines).toEqual([
      "blueprint doctor: 1 problem",
      "",
      "✗ The ruleset on main is missing or out of date",
      "  Agents could push to main.",
      "  → blueprint doctor --fix",
    ]);
  });

  it("explains why doctor couldn't run", () => {
    const lines = formatDoctorReport(
      makeResult({
        ok: false,
        blocked: { title: "No git", why: "Needs git.", action: "git init" },
      }),
    );

    expect(lines).toEqual([
      "blueprint doctor couldn't run: No git",
      "  Needs git.",
      "  → git init",
    ]);
  });
});
