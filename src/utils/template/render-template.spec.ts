import { describe, expect, it } from "vitest";

import { ProjectType } from "./project-type.ts";
import { renderTemplate } from "./render-template.ts";
import type { TemplateOptions } from "./types.ts";

const makeOptions = (overrides: Partial<TemplateOptions> = {}): TemplateOptions => ({
  projectName: "demo",
  description: 'A "quoted" demo',
  type: ProjectType.Ts,
  release: false,
  blueprintVersion: "3.4.5",
  versions: {
    "@stavkamil/blueprint": "^3.4.5",
    "@types/node": "^24.0.0",
    "@vitest/coverage-v8": "^5.0.0",
    eslint: "^10.0.0",
    lefthook: "^2.0.0",
    prettier: "^3.0.0",
    typescript: "~6.0.3",
    vitest: "^5.0.0",
    zod: "^4.0.0",
  },
  pnpmVersion: "12.11.2",
  ...overrides,
});

const readPackageJson = (files: ReadonlyMap<string, string>): Record<string, unknown> =>
  JSON.parse(files.get("package.json") ?? "{}") as Record<string, unknown>;

describe("renderTemplate", () => {
  it("renders exactly the ts project's files", async () => {
    const files = await renderTemplate(makeOptions());

    expect([...files.keys()]).toEqual([
      ".claude/hooks/format-file.sh",
      ".claude/hooks/session-start.sh",
      ".claude/settings.json",
      ".env.example",
      ".github/dependabot.yml",
      ".github/pull_request_template.md",
      ".github/workflows/ai-review.yml",
      ".github/workflows/ci.yml",
      ".gitignore",
      ".nvmrc",
      ".prettierignore",
      "AGENTS.md",
      "CLAUDE.md",
      "docs/blueprint.md",
      "docs/standards/structure.md",
      "docs/standards/testing.md",
      "docs/standards/typescript.md",
      "docs/standards/workflow.md",
      "eslint.config.js",
      "lefthook.yml",
      "package.json",
      "pnpm-workspace.yaml",
      "README.md",
      "REVIEW.md",
      "src/config/env.spec.ts",
      "src/config/env.ts",
      "src/index.spec.ts",
      "src/index.ts",
      "tsconfig.build.json",
      "tsconfig.json",
      "vitest.config.ts",
    ]);
  });

  it("renders the nextjs overlay with React files and guides instead of the ts entry point", async () => {
    const files = await renderTemplate(makeOptions({ type: ProjectType.Nextjs }));

    expect(files.has("src/app/page.tsx")).toBe(true);
    expect(files.has("vitest.setup.ts")).toBe(true);
    expect(files.has("docs/standards/react.md")).toBe(true);
    expect(files.has("src/index.ts")).toBe(false);
    expect(files.has("tsconfig.build.json")).toBe(false);
  });

  it("adds the release workflow and release-please files only with release", async () => {
    const without = await renderTemplate(makeOptions());
    const files = await renderTemplate(makeOptions({ release: true }));

    expect(without.has(".github/workflows/release.yml")).toBe(false);
    expect(files.has(".github/workflows/release.yml")).toBe(true);
    expect(files.has("release-please-config.json")).toBe(true);
    expect(files.get(".release-please-manifest.json")).toContain('".": "0.1.0"');
  });

  it("fills every placeholder", async () => {
    const files = await renderTemplate(makeOptions({ type: ProjectType.Nextjs, release: true }));

    const unfilled = [...files].filter(([, content]) => /\{\{\w+\}\}/u.test(content));

    expect(unfilled.map(([path]) => path)).toEqual([]);
  });

  it("pins the CI callers to the installed blueprint major", async () => {
    const files = await renderTemplate(makeOptions({ release: true }));

    const callers = [...files].filter(([path]) => path.startsWith(".github/workflows/"));

    expect(callers).toHaveLength(3);
    for (const [, content] of callers) {
      expect(content).toMatch(
        /stavkamil\/blueprint\/\.github\/workflows\/reusable-[a-z-]+\.yml@v3\n/u,
      );
    }
  });

  it("writes package.json with the name, description, pnpm and resolved versions", async () => {
    const files = await renderTemplate(makeOptions());

    const pkg = readPackageJson(files);

    expect(pkg).toMatchObject({
      name: "demo",
      description: 'A "quoted" demo',
      type: "module",
      packageManager: "pnpm@12.11.2",
      scripts: { build: "tsc -p tsconfig.build.json", lint: "eslint . && prettier --check ." },
      dependencies: { zod: "^4.0.0" },
      devDependencies: { "@stavkamil/blueprint": "^3.4.5", typescript: "~6.0.3" },
    });
    expect(files.get("package.json")).not.toContain("from-blueprint");
  });

  it("fails clearly when a from-blueprint version is missing", async () => {
    const options = makeOptions({ versions: {} });

    const render = renderTemplate(options);

    await expect(render).rejects.toThrow(/No version for/u);
  });

  it("writes a short AGENTS.md with the standards block, and CLAUDE.md that imports it", async () => {
    const files = await renderTemplate(makeOptions());

    const agents = files.get("AGENTS.md") ?? "";

    expect(agents.split("\n").length).toBeLessThan(60);
    expect(agents).toMatch(/^# demo\n\nA "quoted" demo\n/u);
    expect(agents).toContain("<!-- BEGIN:blueprint-standards -->\n\n## Standards");
    expect(agents).toContain("pnpm lint && pnpm typecheck && pnpm test");
    expect(agents).not.toContain("react.md");
    expect(agents).not.toContain("nextjs-only");
    expect(files.get("CLAUDE.md")).toBe("@AGENTS.md\n");
  });

  it("points nextjs agents at the React guide", async () => {
    const files = await renderTemplate(makeOptions({ type: ProjectType.Nextjs }));

    const agents = files.get("AGENTS.md") ?? "";

    expect(agents).toContain("docs/standards/react.md\n");
    expect(agents).not.toContain("nextjs-only");
  });

  it("quotes the description safely inside TypeScript", async () => {
    const files = await renderTemplate(makeOptions({ type: ProjectType.Nextjs }));

    expect(files.get("src/app/layout.tsx")).toContain('description: "A \\"quoted\\" demo",');
  });

  it("renders the same files every time", async () => {
    const first = await renderTemplate(makeOptions());

    const second = await renderTemplate(makeOptions());

    expect(second).toEqual(first);
  });
});

describe("Claude settings", () => {
  const readSettings = async (): Promise<{
    readonly permissions: {
      readonly allow: readonly string[];
      readonly ask: readonly string[];
      readonly deny: readonly string[];
    };
    readonly sandbox: unknown;
    readonly hooks: Record<string, unknown>;
  }> => {
    const files = await renderTemplate(makeOptions());
    return JSON.parse(files.get(".claude/settings.json") ?? "{}") as Awaited<
      ReturnType<typeof readSettings>
    >;
  };

  it("lets agents run the checks and open PRs without prompts", async () => {
    const { permissions } = await readSettings();

    expect(permissions.allow).toEqual(
      expect.arrayContaining([
        "Bash(pnpm lint *)",
        "Bash(pnpm test *)",
        "Bash(pnpm typecheck)",
        "Bash(pnpm build)",
        "Bash(git commit *)",
        "Bash(gh pr create *)",
      ]),
    );
  });

  it("asks before workflow edits and new dependencies", async () => {
    const { permissions } = await readSettings();

    expect(permissions.ask).toEqual([
      "Edit(/.github/workflows/**)",
      "Edit(/.claude/settings.json)",
      "Bash(pnpm add *)",
      "Bash(pnpm remove *)",
    ]);
  });

  it("denies secrets, force-pushes, merges and repo administration", async () => {
    const { permissions } = await readSettings();

    expect(permissions.deny).toEqual(
      expect.arrayContaining([
        "Read(.env*)",
        "Read(!.env.example)",
        "Bash(git push --force*)",
        "Bash(git push * main)",
        "Bash(gh pr merge *)",
        "Bash(gh repo delete *)",
        "Bash(gh secret *)",
        "Bash(gh api *rulesets*)",
      ]),
    );
  });

  it("sandboxes shell commands away from the workflows and wires both hooks", async () => {
    const { sandbox, hooks } = await readSettings();

    expect(sandbox).toEqual({ enabled: true, filesystem: { denyWrite: [".github/workflows"] } });
    expect(Object.keys(hooks)).toEqual(["SessionStart", "PostToolUse"]);
  });
});
