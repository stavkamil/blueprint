import { base } from "./base.js";
import { boundaries } from "./boundaries.js";
import { tests } from "./tests.js";

/** Complete ESLint config for `ts` projects (libraries, CLIs, services): one import gives the whole standard. */
export const ts = [...base, ...tests, ...boundaries("ts")];
