#!/usr/bin/env bash
# Provision Cloudflare Worker secrets for makanmasak STAGING environment.
#
# Idempotent: re-runs reuse Tier 1 generated values (cached at
# .staging.secrets.generated.json). Tier 2 values are read from
# .staging.secrets.env (user-maintained, gitignored).
#
# Empty Tier 2 values are SKIPPED (logged), not errored — so partial
# setup is fine; come back later and fill in more.
#
# Pre-reqs:
#   - .staging.secrets.env exists (copy from .staging.secrets.env.example)
#   - openssl + jq + python3 available

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

WRANGLER="pnpm wrangler"
GENERATED_FILE=".staging.secrets.generated.json"
TIER2_FILE=".staging.secrets.env"

# === Tier 1: auto-generate or reuse ===
if [[ -f "$GENERATED_FILE" ]]; then
  echo "→ Reusing Tier 1 secrets from $GENERATED_FILE"
else
  echo "→ Generating Tier 1 secrets (32-byte hex each)"
  python3 -c "
import json, secrets
keys = ['JWT_SECRET','REALTIME_JWT_SECRET','ENCRYPTION_KEY','INTERNAL_API_TOKEN','QR_SIGNING_KEY','API_KEY']
out = {k: secrets.token_hex(32) for k in keys}
print(json.dumps(out, indent=2))
" > "$GENERATED_FILE"
  chmod 600 "$GENERATED_FILE"
fi

JWT_SECRET=$(jq -r .JWT_SECRET "$GENERATED_FILE")
REALTIME_JWT_SECRET=$(jq -r .REALTIME_JWT_SECRET "$GENERATED_FILE")
ENCRYPTION_KEY=$(jq -r .ENCRYPTION_KEY "$GENERATED_FILE")
INTERNAL_API_TOKEN=$(jq -r .INTERNAL_API_TOKEN "$GENERATED_FILE")
QR_SIGNING_KEY=$(jq -r .QR_SIGNING_KEY "$GENERATED_FILE")
API_KEY=$(jq -r .API_KEY "$GENERATED_FILE")

# === Tier 2: load from .staging.secrets.env ===
if [[ -f "$TIER2_FILE" ]]; then
  echo "→ Loading Tier 2 secrets from $TIER2_FILE"
  set -a; source "$TIER2_FILE"; set +a
else
  echo "⚠  $TIER2_FILE missing — Tier 2 secrets will be skipped."
  echo "   Copy template: cp .staging.secrets.env.example $TIER2_FILE"
fi

# Default empties to '' so unset vars don't cause -u errors below
RESEND_API_KEY="${RESEND_API_KEY:-}"
TWILIO_ACCOUNT_SID="${TWILIO_ACCOUNT_SID:-}"
TWILIO_AUTH_TOKEN="${TWILIO_AUTH_TOKEN:-}"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY:-}"
STRIPE_WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET:-}"
CLOUDFLARE_IMAGES_API_TOKEN="${CLOUDFLARE_IMAGES_API_TOKEN:-}"
EMAIL_API_KEY="${EMAIL_API_KEY:-}"
ALERT_EMAIL_TO="${ALERT_EMAIL_TO:-}"

# Cloudflare account ID (public — derived from `wrangler whoami`)
CLOUDFLARE_ACCOUNT_ID="bdddc08c066a9abc285d75fe5947a468"

# === Helper: set one secret on one Worker ===
set_secret() {
  local app="$1" name="$2" value="$3"
  local config="apps/$app/wrangler.toml"
  if [[ -z "$value" ]]; then
    printf "  ⊘ %-32s (empty — skipped)\n" "$name"
    return 0
  fi
  if printf '%s' "$value" | $WRANGLER secret put "$name" --env staging --config "$config" >/tmp/secret-put.log 2>&1; then
    printf "  ✓ %-32s\n" "$name"
  else
    printf "  ✗ %-32s — see /tmp/secret-put.log\n" "$name"
    cat /tmp/secret-put.log
    return 1
  fi
}

# === Per-Worker secret assignments ===
echo ""
echo "=== apps/api (12 secrets) ==="
set_secret api JWT_SECRET                    "$JWT_SECRET"
set_secret api REALTIME_JWT_SECRET           "$REALTIME_JWT_SECRET"
set_secret api ENCRYPTION_KEY                "$ENCRYPTION_KEY"
set_secret api INTERNAL_API_TOKEN            "$INTERNAL_API_TOKEN"
set_secret api QR_SIGNING_KEY                "$QR_SIGNING_KEY"
set_secret api RESEND_API_KEY                "$RESEND_API_KEY"
set_secret api TWILIO_ACCOUNT_SID            "$TWILIO_ACCOUNT_SID"
set_secret api TWILIO_AUTH_TOKEN             "$TWILIO_AUTH_TOKEN"
set_secret api SLACK_WEBHOOK_URL             "$SLACK_WEBHOOK_URL"
set_secret api STRIPE_SECRET_KEY             "$STRIPE_SECRET_KEY"
set_secret api STRIPE_WEBHOOK_SECRET         "$STRIPE_WEBHOOK_SECRET"
set_secret api ALERT_EMAIL_TO                "$ALERT_EMAIL_TO"

echo ""
echo "=== apps/realtime (2 secrets) ==="
set_secret realtime JWT_SECRET               "$JWT_SECRET"
set_secret realtime REALTIME_JWT_SECRET      "$REALTIME_JWT_SECRET"

echo ""
echo "=== apps/management-api (5 secrets) ==="
set_secret management-api JWT_SECRET         "$JWT_SECRET"
set_secret management-api ENCRYPTION_KEY     "$ENCRYPTION_KEY"
set_secret management-api INTERNAL_API_TOKEN "$INTERNAL_API_TOKEN"
set_secret management-api EMAIL_API_KEY      "$EMAIL_API_KEY"
set_secret management-api SLACK_WEBHOOK_URL  "$SLACK_WEBHOOK_URL"

echo ""
echo "=== apps/image-processor (5 secrets) ==="
set_secret image-processor JWT_SECRET                     "$JWT_SECRET"
set_secret image-processor API_KEY                        "$API_KEY"
set_secret image-processor CLOUDFLARE_ACCOUNT_ID          "$CLOUDFLARE_ACCOUNT_ID"
set_secret image-processor CLOUDFLARE_IMAGES_API_TOKEN    "$CLOUDFLARE_IMAGES_API_TOKEN"
set_secret image-processor SLACK_WEBHOOK_URL              "$SLACK_WEBHOOK_URL"

echo ""
echo "Done."
echo ""
echo "Tier 1 generated values are cached at $GENERATED_FILE (chmod 600, gitignored)."
echo "Re-running this script reuses them — secrets stay consistent across Workers."
echo "To rotate Tier 1: delete $GENERATED_FILE and re-run."
