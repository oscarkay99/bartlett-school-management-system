#!/usr/bin/env bash
# Auto-commit local changes to the `development` branch.
# Runs from the Claude Code Stop hook. It only ever commits on `development`,
# so work on `testing` (QA) or `main` is never committed automatically.
set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0

[ "$(git rev-parse --abbrev-ref HEAD)" = "development" ] || exit 0
[ -n "$(git status --porcelain)" ] || exit 0

git add -A
git diff --cached --quiet && exit 0

files=$(git diff --cached --name-only | wc -l | tr -d ' ')
summary=$(git diff --cached --name-only | sed 's#/[^/]*$##' | sort | uniq -c | sort -rn | head -3 | awk '{print $2}' | paste -sd, -)
git commit -q -m "chore(auto): ${files} file(s) changed in ${summary:-root}

Automatic commit of local changes on development.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" >/dev/null
echo "auto-committed ${files} file(s) to development"
