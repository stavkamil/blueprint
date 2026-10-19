import { type GhApiResult, HttpMethod } from "../../../lib/gh-api.ts";
import { isJsonSubset } from "../../../utils/is-json-subset.ts";
import { expectedRuleset, rulesetName } from "../constants.ts";
import { type Check, type CheckResult, CheckStatus, type GithubContext, Scope } from "../types.ts";
import { apiFailureFinding } from "./api-failure-finding.ts";
import { isUpgradeRequired, noProFinding } from "./no-pro-finding.ts";

type RulesetSummary = { readonly id: number; readonly name: string };
type Rule = { readonly type: string };

const isRulesetList = (body: unknown): body is readonly RulesetSummary[] =>
  Array.isArray(body) &&
  body.every((item) => typeof item === "object" && item !== null && "id" in item && "name" in item);

const findRuleset = async (
  context: GithubContext,
): Promise<{ readonly id?: number; readonly failure?: GhApiResult }> => {
  const list = await context.getRepo("/rulesets");
  if (!list.ok) {
    return { failure: list };
  }
  return {
    id: isRulesetList(list.body)
      ? list.body.find((ruleset) => ruleset.name === rulesetName)?.id
      : undefined,
  };
};

const matchesExpected = (actual: unknown): boolean => {
  if (
    typeof actual !== "object" ||
    actual === null ||
    !("rules" in actual) ||
    !Array.isArray(actual.rules)
  ) {
    return false;
  }
  const { rules: expectedRules, ...expectedSettings } = expectedRuleset;
  const actualRules = actual.rules as readonly Rule[];
  return (
    isJsonSubset(expectedSettings, actual) &&
    actualRules.length === expectedRules.length &&
    expectedRules.every((expected) =>
      isJsonSubset(
        expected,
        actualRules.find((rule) => rule.type === expected.type),
      ),
    )
  );
};

const outdated: CheckResult = {
  status: CheckStatus.Fail,
  title: "The ruleset on main is missing or out of date",
  why: "Without it, agents can push straight to main or merge without green CI.",
  action: "blueprint doctor --fix",
};

/** `repo.ruleset`: the `blueprint-main` ruleset protects the default branch exactly as blueprint expects. */
export const repoRulesetCheck: Check = {
  id: "repo.ruleset",
  name: "Ruleset blueprint-main",
  scope: Scope.Github,
  /**
   *
   */
  /** Finds the blueprint-main ruleset and compares it. */
  run: async (context) => {
    const { id, failure } = await findRuleset(context);
    if (failure !== undefined && !failure.ok) {
      return isUpgradeRequired(failure.message)
        ? { status: CheckStatus.Fail, ...noProFinding }
        : { status: CheckStatus.Fail, ...apiFailureFinding("read the rulesets", failure.message) };
    }
    if (id === undefined) {
      return outdated;
    }
    const ruleset = await context.getRepo(`/rulesets/${String(id)}`);
    return ruleset.ok && matchesExpected(ruleset.body) ? { status: CheckStatus.Pass } : outdated;
  },
  /**
   *
   */
  /** Creates or updates the ruleset by name. */
  fix: async (context) => {
    const { id } = await findRuleset(context);
    const base = `repos/${context.repo.owner}/${context.repo.name}/rulesets`;
    const result =
      id === undefined
        ? await context.ghApi(base, { method: HttpMethod.Post, body: expectedRuleset })
        : await context.ghApi(`${base}/${String(id)}`, {
            method: HttpMethod.Put,
            body: expectedRuleset,
          });
    if (result.ok) {
      return undefined;
    }
    return isUpgradeRequired(result.message)
      ? noProFinding
      : apiFailureFinding("create the ruleset", result.message);
  },
};
