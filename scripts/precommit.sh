#!/usr/bin/env bash
# Local CI replacement. Hooks/pre-commit -> this file.
# Install: ln -sf ../../scripts/precommit.sh .git/hooks/pre-commit && chmod +x scripts/precommit.sh
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

echo "[precommit] tsc --noEmit"
npm run --silent typecheck

echo "[precommit] npm run validate-levels"
npm run --silent validate-levels

npm test

echo "[precommit] OK"
