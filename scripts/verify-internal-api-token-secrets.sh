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
  local output

  if ! output="$($WRANGLER secret list --env "$ENVIRONMENT" --config "$config" 2>&1)"; then
    printf "ERROR unable to list secrets for %s in %s\n" "$app" "$ENVIRONMENT" >&2
    printf "%s\n" "$output" >&2
    return 1
  fi

  if printf "%s\n" "$output" | grep -q 'INTERNAL_API_TOKEN'; then
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
