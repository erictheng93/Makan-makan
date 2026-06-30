#!/usr/bin/env bash
# Verify the cross-worker INTERNAL_API_TOKEN secret exists on both Workers.
# Cloudflare does not expose secret values, so this check proves presence only.

set -euo pipefail

ENVIRONMENT="${1:-staging}"
WRANGLER="${WRANGLER:-pnpm wrangler}"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

check_secret() {
  local app="$1"
  local config="apps/$app/wrangler.toml"

  if $WRANGLER secret list --env "$ENVIRONMENT" --config "$config" \
    | grep -q 'INTERNAL_API_TOKEN'; then
    printf "OK %s has INTERNAL_API_TOKEN for %s\n" "$app" "$ENVIRONMENT"
  else
    printf "ERROR %s is missing INTERNAL_API_TOKEN for %s\n" "$app" "$ENVIRONMENT" >&2
    return 1
  fi
}

check_secret api
check_secret management-api

cat <<EOF

Presence check passed.
Cloudflare hides secret values, so also confirm both Workers were populated
from the same token during provisioning.
EOF
