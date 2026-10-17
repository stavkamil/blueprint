#!/usr/bin/env node
import { run } from "./commands/main.ts";

process.exitCode = await run(process.argv.slice(2));
