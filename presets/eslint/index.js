import { base } from "./base.js";
import { boundaries } from "./boundaries.js";
import { react } from "./react.js";
import { tests } from "./tests.js";

/** Complete ESLint config for `ts` projects (libraries, CLIs, services): one import gives the whole standard. */
export const ts = [...base, ...tests, ...boundaries("ts")];

/** Complete ESLint config for `nextjs` projects; spread it after eslint-config-next, which registers React's plugins. */
export const nextjs = [
  ...base,
  ...react,
  ...tests,
  ...boundaries("nextjs"),
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "check-file/folder-naming-convention": [
        "error",
        { "src/app/**/": "NEXT_JS_APP_ROUTER_CASE", "src/!(app)/**/": "KEBAB_CASE" },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../../*"],
              message: "Import across folders with the @/ alias (e.g. @/utils/format).",
            },
          ],
        },
      ],
    },
  },
];
