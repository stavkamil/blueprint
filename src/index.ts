#!/usr/bin/env node
import { run } from "./commands/main.ts";

const [, , ...args] = process.argv;
process.exitCode = await run(args);
