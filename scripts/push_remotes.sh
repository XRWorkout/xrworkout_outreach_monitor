#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

branch="${1:-$(git branch --show-current)}"
if [ -z "$branch" ]; then
  echo "No current branch detected. Pass the branch name explicitly."
  exit 1
fi

git push origin "$branch"
git push xrworkout "$branch"
