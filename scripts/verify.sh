#!/usr/bin/env bash
#
# Two verification tiers.
#
#   scripts/verify.sh           inner loop — only what this branch affected
#   scripts/verify.sh --full    pre-push gate — mirrors .github/workflows/test.yml
#
# The inner loop is meant to be run after every meaningful edit. The full gate
# is meant to be run once, before pushing — not after every edit.
#
# Both tiers go through turbo, so unchanged packages are cache hits rather than
# re-runs. The full gate is therefore "full coverage at incremental cost": it
# still accounts for every package, but only re-executes the ones whose inputs
# actually moved. Cache correctness comes from `$TURBO_DEFAULT$` inputs plus
# `dependsOn: ["^build"]`, which makes a change in packages/database invalidate
# every dependent app's test task too.

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

MODE="affected"
if [ "${1:-}" = "--full" ]; then
  MODE="full"
elif [ $# -gt 0 ]; then
  echo "usage: scripts/verify.sh [--full]" >&2
  exit 1
fi

FAILED=()

step() {
  local label="$1"
  shift
  local start=$SECONDS
  printf '\n\033[1m▶ %s\033[0m\n' "$label"
  if "$@"; then
    printf '\033[32m✓ %s\033[0m (%ss)\n' "$label" "$((SECONDS - start))"
  else
    printf '\033[31m✗ %s\033[0m (%ss)\n' "$label" "$((SECONDS - start))"
    FAILED+=("$label")
  fi
}

# turbo only ever schedules workspace packages, so the root vitest project
# (tests/unit, tests/e2e, tests/performance — 19 files) is invisible to
# `turbo run test`. Run it explicitly rather than letting it rot unrun.
root_tests_changed() {
  local base
  base="$(git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main 2>/dev/null || echo HEAD)"
  ! git diff --quiet "$base" -- tests/ 2>/dev/null ||
    ! git diff --quiet -- tests/ 2>/dev/null
}

if [ "$MODE" = "affected" ]; then
  echo "Verifying what this branch affected (vs the merge-base with main)."
  echo "Run 'pnpm verify:push' before pushing for the full gate."

  step "typecheck + lint + test (affected)" \
    pnpm exec turbo run typecheck lint test --affected

  if root_tests_changed; then
    step "root tests (tests/ changed)" \
      pnpm exec vitest run --project root
  fi
else
  echo "Full pre-push gate — mirrors .github/workflows/test.yml."
  echo "Unchanged packages come back as turbo cache hits."

  step "lint" pnpm run lint
  step "typecheck" pnpm run typecheck
  step "prettier" pnpm exec prettier --check "**/*.{ts,js,cjs,mjs,vue,json,md}"
  step "i18n locale coverage" pnpm run check:i18n-locales
  step "integration allowlist" node scripts/check-integration-allowlist.cjs
  step "package test scripts" node scripts/check-package-test-scripts.cjs
  step "production config" env \
    CHECK_PRODUCTION_CONFIG_REQUIRE_DEPLOYMENT_SECRETS=false \
    pnpm run check:prod-config
  step "migration dual-track" pnpm run check:migration-dual-track
  step "no destructive wrangler" pnpm run check:no-automated-destructive-wrangler
  step "guard script regressions" pnpm run test:ci-guards
  step "package tests" pnpm exec turbo run test
  step "root tests" pnpm exec vitest run --project root
fi

echo
if [ ${#FAILED[@]} -eq 0 ]; then
  printf '\033[32mAll checks passed\033[0m (%ss total)\n' "$SECONDS"
  exit 0
fi

printf '\033[31m%d check(s) failed:\033[0m\n' "${#FAILED[@]}"
printf '  - %s\n' "${FAILED[@]}"
exit 1
