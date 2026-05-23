#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

if git diff --quiet && git diff --cached --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; then
  echo "No project changes to save."
  exit 0
fi

message="${1:-Auto-save project changes}"

git add -A
git commit -m "$message"

if git remote get-url origin >/dev/null 2>&1; then
  git push origin HEAD
else
  echo "Saved locally. Add a GitHub remote named origin to push this checkpoint online."
fi

if git remote get-url xrworkout >/dev/null 2>&1; then
  git push xrworkout HEAD
fi
