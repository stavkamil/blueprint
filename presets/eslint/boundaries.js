import boundariesPlugin from "eslint-plugin-boundaries";

const sharedFolders = ["utils", "types", "config", "lib", "components", "hooks"];

const sharedElements = sharedFolders.map((folder) => ({
  type: "shared",
  pattern: `src/${folder}`,
}));

const layouts = {
  ts: [
    { type: "entry", pattern: "src/commands" },
    { type: "feature", pattern: "src/modules/*", capture: ["name"] },
    ...sharedElements,
  ],
  nextjs: [
    { type: "entry", pattern: "src/app" },
    { type: "feature", pattern: "src/features/*", capture: ["name"] },
    ...sharedElements,
  ],
};

/**
 * Feature boundaries: a feature (or ts module) imports only itself and shared folders, shared folders import only
 * shared folders, and entry points compose features.
 * @param layout which project layout to enforce: "ts" or "nextjs"
 */
export const boundaries = (layout) => [
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { boundaries: boundariesPlugin },
    settings: {
      "boundaries/elements": layouts[layout],
      // Resolves .ts imports and tsconfig paths (the nextjs @/ alias), so every local import gets checked.
      "import/resolver": { typescript: { alwaysTryTypes: true } },
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          message:
            "{{ from.element.type }} code can't import from {{ to.element.type }} code. Features import only themselves and shared folders (src/utils, src/types, src/config, src/lib); compose features in an entry point.",
          policies: [
            {
              from: { element: { type: "entry" } },
              allow: { to: { element: { type: ["entry", "feature", "shared"] } } },
            },
            {
              from: { element: { type: "feature" } },
              allow: [
                { to: { element: { type: "shared" } } },
                {
                  to: {
                    element: {
                      type: "feature",
                      captured: { name: "{{ from.element.captured.name }}" },
                    },
                  },
                },
              ],
            },
            {
              from: { element: { type: "shared" } },
              allow: { to: { element: { type: "shared" } } },
            },
          ],
        },
      ],
    },
  },
];
