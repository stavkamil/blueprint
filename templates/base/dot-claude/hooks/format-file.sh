#!/usr/bin/env bash
# Formats the file Claude just edited, so every diff is already Prettier-clean. Silent, and never blocks the edit.
set -uo pipefail

file=$(node -e 'let s="";process.stdin.on("data",(d)=>{s+=d}).on("end",()=>{process.stdout.write(JSON.parse(s).tool_input?.file_path??"")})')
if [ -z "$file" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"
pnpm exec prettier --write --ignore-unknown --log-level silent "$file" >/dev/null 2>&1 || true
