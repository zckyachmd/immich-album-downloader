#!/bin/bash
set -euo pipefail

# Only check for uncommitted changes in local environment, not in CI
if [[ "${CI:-false}" != "true" ]]; then
  if ! git diff-index --quiet HEAD -- 2>/dev/null; then
    echo "⚠️  Warning: There are uncommitted changes in the repository."
    echo "   This is OK in CI, but you may want to commit changes for local builds."
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      exit 1
    fi
  fi
fi

./build.sh Dockerfile
