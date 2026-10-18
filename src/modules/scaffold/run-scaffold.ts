import { join } from "node:path";

import type { RunCommand } from "../../lib/run-command.ts";
import { scaffoldSteps } from "./steps.ts";
import { type ScaffoldOptions, type ScaffoldResult, type Step, StepStatus } from "./types.ts";

/**
 * Runs the steps in order and stops at the first failure, so later steps (like creating the repo) never run on a
 * broken project.
 * @param options the project to create
 * @param run runs external commands; tests pass a fake
 * @param onDone called with each finished step's title, for progress output
 * @param steps the steps to run; tests pass their own
 */
export const runScaffold = async (
  options: ScaffoldOptions,
  run: RunCommand,
  onDone: (title: string) => void = () => undefined,
  steps: readonly Step[] = scaffoldSteps,
): Promise<ScaffoldResult> => {
  const dir = join(options.parentDir, options.template.projectName);
  const statuses = new Map(steps.map((step) => [step.id, StepStatus.Pending as StepStatus]));
  const report = (fields: Partial<ScaffoldResult>): ScaffoldResult => ({
    ok: true,
    dir,
    steps: [...statuses].map(([id, status]) => ({ id, status })),
    ...fields,
  });

  let url: string | undefined;
  for (const step of steps) {
    if (step.isSkipped(options)) {
      statuses.set(step.id, StepStatus.Skipped);
      continue;
    }
    const outcome = await step.run({ options, dir, run });
    if (outcome.problem !== undefined) {
      statuses.set(step.id, StepStatus.Failed);
      return report({ ok: false, url, problem: outcome.problem });
    }
    url = outcome.url ?? url;
    statuses.set(step.id, StepStatus.Done);
    onDone(step.title(options));
  }
  return report({ url });
};
