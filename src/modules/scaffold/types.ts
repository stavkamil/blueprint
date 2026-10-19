import type { RunCommand } from "../../lib/run-command.ts";
import type { TemplateOptions } from "../../utils/template/types.ts";

/** Who can see the new GitHub repo. */
export const Visibility = { Private: "private", Public: "public" } as const;

/** One of {@link Visibility}'s values. */
export type Visibility = (typeof Visibility)[keyof typeof Visibility];

/** Everything `blueprint new` needs to create one project. */
export type ScaffoldOptions = {
  readonly template: TemplateOptions;
  /** The folder the project folder is created in. */
  readonly parentDir: string;
  readonly visibility: Visibility;
  /** Creates and pushes the GitHub repo; off with `--no-github`. */
  readonly github: boolean;
};

/** Something that stopped the run: what happened, what to do, and the command output when there is some. */
export type Problem = {
  readonly message: string;
  readonly hint: string;
  readonly output?: string;
};

/** The steps `blueprint new` runs after preflight, in order. */
export const StepId = {
  Scaffold: "scaffold",
  InitGit: "init-git",
  Install: "install",
  Verify: "verify",
  Commit: "commit",
  CreateRepo: "create-repo",
} as const;

/** One of {@link StepId}'s values. */
export type StepId = (typeof StepId)[keyof typeof StepId];

/** How a step ended. Steps after a failure stay pending. */
export const StepStatus = {
  Done: "done",
  Failed: "failed",
  Skipped: "skipped",
  Pending: "pending",
} as const;

/** One of {@link StepStatus}'s values. */
export type StepStatus = (typeof StepStatus)[keyof typeof StepStatus];

/** What every step gets: the options, the project folder and the command runner. */
export type StepContext = {
  readonly options: ScaffoldOptions;
  readonly dir: string;
  readonly run: RunCommand;
};

/** A step's result: a problem when it failed, and the repo URL once the repo exists. */
export type StepOutcome = {
  readonly problem?: Problem;
  readonly url?: string;
};

/** One step of the run, as data, so one runner executes them in order and stops at the first failure. */
export type Step = {
  readonly id: StepId;
  /** The line printed when the step succeeds. */
  readonly title: (options: ScaffoldOptions) => string;
  readonly isSkipped: (options: ScaffoldOptions) => boolean;
  readonly run: (context: StepContext) => Promise<StepOutcome>;
};

/** The outcome of a whole run, for the human summary and `--json`. */
export type ScaffoldResult = {
  readonly ok: boolean;
  readonly dir: string;
  readonly url?: string;
  readonly steps: readonly { readonly id: StepId; readonly status: StepStatus }[];
  readonly problem?: Problem;
};
