#!/usr/bin/env bash

set -euo pipefail

full="${1:-false}"
app=false
backend=false
frontend=false
integration=false
tooling=false
guard_tests=false
full_lint=false

if [ "$full" = "true" ]; then
  app=true
  backend=true
  frontend=true
  integration=true
  tooling=true
else
  while IFS= read -r file; do
    [ -z "$file" ] && continue

    case "$file" in
      pnpm-lock.yaml | package.json | pnpm-workspace.yaml | turbo.json | \
        tsconfig*.json | vitest*.config.* | playwright*.config.* | .npmrc | \
        codecov.yml)
        full=true
        app=true
        backend=true
        frontend=true
        integration=true
        tooling=true
        ;;
      eslint.config.*)
        tooling=true
        full_lint=true
        ;;
      .prettierignore | .prettierrc*)
        tooling=true
        ;;
      scripts/classify-ci-changes.sh | \
        scripts/check-package-test-scripts.cjs | \
        scripts/check-production-config.cjs | \
        scripts/check-migration-dual-track.cjs | \
        scripts/check-docs-drift.cjs)
        tooling=true
        guard_tests=true
        ;;
      scripts/*)
        tooling=true
        ;;
      .github/workflows/*)
        full=true
        app=true
        backend=true
        frontend=true
        integration=true
        tooling=true
        ;;
      apps/customer-app/* | apps/admin-dashboard/* | apps/kitchen-display/*)
        app=true
        frontend=true
        integration=true
        ;;
      apps/management-portal/* | apps/onboarding-app/*)
        app=true
        frontend=true
        ;;
      apps/api/* | apps/management-api/*)
        app=true
        backend=true
        integration=true
        ;;
      apps/realtime/* | apps/image-processor/* | apps/backup-scheduler/* | \
        apps/print-agent/*)
        app=true
        backend=true
        ;;
      packages/database/* | packages/queue-core/* | packages/queue-service/* | \
        packages/shared/* | packages/shared-types/* | packages/utils/* | \
        packages/auth-client/* | packages/ai-analytics/*)
        app=true
        backend=true
        frontend=true
        integration=true
        ;;
      tests/unit/* | tests/security/*)
        app=true
        backend=true
        ;;
      tests/integration/*)
        app=true
        backend=true
        integration=true
        ;;
      tests/e2e/* | tests/visual/* | tests/performance/*)
        app=true
        frontend=true
        ;;
      apps/* | packages/*)
        # Unknown workspaces get the widest scope. Missing a new suite is more
        # expensive than temporarily over-running CI.
        app=true
        backend=true
        frontend=true
        integration=true
        ;;
      docs/* | .github/* | *.md | *.png | *.jpg | *.jpeg)
        ;;
      *)
        # Only explicit documentation and workflow paths may skip validation.
        full=true
        app=true
        backend=true
        frontend=true
        integration=true
        tooling=true
        ;;
    esac
  done
fi

printf 'app=%s\n' "$app"
printf 'backend=%s\n' "$backend"
printf 'frontend=%s\n' "$frontend"
printf 'integration=%s\n' "$integration"
printf 'tooling=%s\n' "$tooling"
printf 'guard_tests=%s\n' "$guard_tests"
printf 'full_lint=%s\n' "$full_lint"
printf 'full=%s\n' "$full"
