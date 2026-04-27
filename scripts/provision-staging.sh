#!/usr/bin/env bash
# Provision Cloudflare resources for makanmasak STAGING environment.
#
# Idempotent: safe to re-run. Uses `wrangler X create` which fails non-fatally
# if the resource exists; we then look up the ID via `... list`.
#
# After every create, the UUID is sed-substituted into all REPLACE_ME__STAGING__*
# tokens across apps/*/wrangler.toml. After the script finishes,
# `grep -rn 'REPLACE_ME__STAGING' apps/` MUST be empty for staging deploys.
#
# Pre-reqs:
#   1. `pnpm wrangler whoami` shows r2(write) and zone(write) scopes.
#   2. Run from repo root.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

WRANGLER="pnpm wrangler"
TOML_GLOB=(apps/api/wrangler.toml apps/management-api/wrangler.toml apps/realtime/wrangler.toml apps/image-processor/wrangler.toml apps/backup-scheduler/wrangler.toml)

# Substitute REPLACE_ME__STAGING__<TOKEN> with a real ID across all toml files.
substitute() {
  local token="$1" value="$2"
  if [[ -z "$value" ]]; then
    echo "  ✗ empty value for $token — skipping"; return 1
  fi
  perl -i -pe "s/REPLACE_ME__STAGING__${token}/${value}/g" "${TOML_GLOB[@]}"
  echo "  ✓ wrote ${token}=${value}"
}

# Create D1 (or look up existing) and substitute its UUID.
provision_d1() {
  local db_name="$1" token="$2"
  echo "→ D1: $db_name"
  local id
  id="$($WRANGLER d1 list --json 2>/dev/null | jq -r ".[] | select(.name==\"$db_name\") | .uuid" || true)"
  if [[ -z "$id" || "$id" == "null" ]]; then
    $WRANGLER d1 create "$db_name" >/tmp/d1-create.log 2>&1 || true
    id="$($WRANGLER d1 list --json 2>/dev/null | jq -r ".[] | select(.name==\"$db_name\") | .uuid")"
  fi
  substitute "$token" "$id"
}

# Create KV namespace (or look up) and substitute.
provision_kv() {
  local ns_name="$1" token="$2"
  echo "→ KV: $ns_name"
  local id
  id="$($WRANGLER kv namespace list 2>/dev/null | jq -r ".[] | select(.title==\"$ns_name\") | .id" || true)"
  if [[ -z "$id" || "$id" == "null" ]]; then
    $WRANGLER kv namespace create "$ns_name" >/tmp/kv-create.log 2>&1 || true
    id="$($WRANGLER kv namespace list 2>/dev/null | jq -r ".[] | select(.title==\"$ns_name\") | .id")"
  fi
  substitute "$token" "$id"
}

# Create R2 bucket (no UUID — bucket_name in toml is already the literal name).
# Idempotent: `r2 bucket create` errors if exists; we swallow and check via list.
provision_r2() {
  local bucket="$1"
  echo "→ R2: $bucket"
  $WRANGLER r2 bucket create "$bucket" >/tmp/r2-create.log 2>&1 || true
  if $WRANGLER r2 bucket list 2>/dev/null | grep -q "$bucket"; then
    echo "  ✓ ready"
  else
    echo "  ✗ create failed — log:"
    cat /tmp/r2-create.log
    return 1
  fi
}

echo "=== D1 databases ==="
provision_d1 "makanmasak-staging"            "API_DB"
provision_d1 "makanmasak-management-staging" "MGMT_DB"

echo ""
echo "=== KV namespaces ==="
provision_kv "makanmasak-cache-staging"              "CACHE_KV"
provision_kv "makanmasak-ratelimit-staging"          "RATELIMIT_KV"
provision_kv "makanmasak-backup-staging"             "BACKUP_KV"
provision_kv "makanmasak-token-blacklist-staging"    "TOKEN_BLACKLIST_KV"
provision_kv "makanmasak-management-cache-staging"   "MGMT_CACHE_KV"
provision_kv "makanmasak-deployment-status-staging"  "MGMT_DEPLOY_STATUS_KV"

echo ""
echo "=== R2 buckets ==="
provision_r2 "makanmasak-backups-staging"
provision_r2 "makanmasak-images-staging"
provision_r2 "makanmasak-management-bundles-staging"

echo ""
echo "=== Verification ==="
remaining="$(grep -roEh 'REPLACE_ME__STAGING__[A-Z_]+' apps/*/wrangler.toml | sort -u || true)"
if [[ -z "$remaining" ]]; then
  echo "✓ All REPLACE_ME__STAGING__* tokens substituted."
else
  echo "✗ Remaining tokens (substitution incomplete):"
  echo "$remaining"
  exit 1
fi

echo ""
echo "Done. Review with: git diff apps/*/wrangler.toml"
