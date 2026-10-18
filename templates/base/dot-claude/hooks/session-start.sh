#!/usr/bin/env bash
# Installs dependencies when a cloud session starts. Local sessions already have them, so it does nothing there.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"
pnpm install --frozen-lockfile
