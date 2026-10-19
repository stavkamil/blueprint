import type { GhApi, GhApiResult } from "../../lib/gh-api.ts";
import type { RunCommand } from "../../lib/run-command.ts";

/** How a check ended. */
export const CheckStatus = { Pass: "pass", Fail: "fail", Skipped: "skipped" } as const;

/** One of {@link CheckStatus}'s values. */
export type CheckStatus = (typeof CheckStatus)[keyof typeof CheckStatus];

/** A failure explained for a person: what's wrong, why it matters, and the exact next step. */
export type Finding = {
  readonly title: string;
  readonly why: string;
  readonly action: string;
};

/** A check's answer: pass, skipped (doesn't apply), or fail with a finding. */
export type CheckResult =
  | { readonly status: typeof CheckStatus.Pass | typeof CheckStatus.Skipped }
  | ({ readonly status: typeof CheckStatus.Fail } & Finding);

/** The GitHub repo the project's `origin` points at. */
export type GithubRepo = { readonly owner: string; readonly name: string };

/** What local checks read from: the project folder and the command runner. */
export type LocalContext = {
  readonly dir: string;
  readonly run: RunCommand;
};

/** What GitHub checks read from. GitHub responses are fetched once per context and shared. */
export type GithubContext = LocalContext & {
  readonly ghApi: GhApi;
  readonly repo: GithubRepo;
  /** A cached GET of `repos/<owner>/<name><suffix>`, e.g. `/rulesets`. */
  readonly getRepo: (suffix?: string) => Promise<GhApiResult>;
};

/** Where a check looks: the project folder only, or also the GitHub repo. */
export const Scope = { Local: "local", Github: "github" } as const;

/** One of {@link Scope}'s values. */
export type Scope = (typeof Scope)[keyof typeof Scope];

/** A check's behavior for one kind of context. */
export type CheckDefinition<Context> = {
  readonly id: string;
  /** A neutral name, printed as `fixed: <name>`. */
  readonly name: string;
  readonly run: (context: Context) => Promise<CheckResult>;
  /** Repairs the problem. Returns a finding when it can't (a missing Keychain item, no GitHub Pro). */
  readonly fix?: (context: Context) => Promise<Finding | undefined>;
};

/** One thing doctor checks, as data: how to check it and, when it's fixable, how to fix it. */
export type Check =
  | ({ readonly scope: typeof Scope.Local } & CheckDefinition<LocalContext>)
  | ({ readonly scope: typeof Scope.Github } & CheckDefinition<GithubContext>);

/** One check's outcome in a doctor run. */
export type CheckReport = {
  readonly id: string;
  readonly name: string;
  readonly status: CheckStatus;
} & Partial<Finding>;

/** The outcome of a doctor run, for the human report, `--json` and `blueprint new`. */
export type DoctorResult = {
  readonly ok: boolean;
  /** Set when doctor couldn't run at all (not a git repo, gh logged out). */
  readonly blocked?: Finding;
  /** True when there's no GitHub remote, so only local checks ran. */
  readonly isLocalOnly: boolean;
  readonly checks: readonly CheckReport[];
  /** Names of the checks `--fix` repaired. */
  readonly fixed: readonly string[];
};
