#!/usr/bin/env bash
# Local CI replacement. Hooks/pre-commit -> this file.
# Install: ln -sf ../../scripts/precommit.sh .git/hooks/pre-commit && chmod +x scripts/precommit.sh
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

echo "[precommit] tsc --noEmit"
npx tsc --noEmit

echo "[precommit] npm run validate-levels"
npm run --silent validate-levels

echo "[precommit] OK"
