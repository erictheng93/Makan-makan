#!/usr/bin/env bash
set -euo pipefail

# Build and upload a worker bundle to R2 for tenant deployment.
# Usage: ./scripts/build-and-upload-bundle.sh <version> [environment]
# Example: ./scripts/build-and-upload-bundle.sh 1.2.0 staging

VERSION="${1:?Usage: $0 <version> [environment]}"
ENVIRONMENT="${2:-production}"

echo "=== Building MakanMasak API bundle v${VERSION} ==="

# 1. Build the API worker
echo "Building API worker..."
pnpm --filter api build

# 2. Collect the built bundle
DIST_DIR="apps/api/dist"
if [ ! -f "$DIST_DIR/index.js" ]; then
  echo "ERROR: Build output not found at $DIST_DIR/index.js"
  exit 1
fi

BUNDLE_FILE="$DIST_DIR/index.js"

# 3. Collect migration SQL files
echo "Collecting migrations..."
MIGRATIONS_DIR="packages/database/migrations_fresh"
MIGRATIONS_JSON="[]"

if [ -d "$MIGRATIONS_DIR" ]; then
  MIGRATIONS_JSON=$(node -e "
    const fs = require('fs');
    const path = require('path');
    const dir = '$MIGRATIONS_DIR';
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    const migrations = files.map(f => ({
      name: f,
      sql: fs.readFileSync(path.join(dir, f), 'utf8')
    }));
    console.log(JSON.stringify(migrations));
  ")
fi

MIGRATION_COUNT=$(echo "$MIGRATIONS_JSON" | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).length))")
echo "Found $MIGRATION_COUNT migration files"

# 4. Upload to R2 via wrangler
BUCKET="makanmasak-management-bundles-${ENVIRONMENT}"
echo "Uploading to R2 bucket: $BUCKET"

# Upload worker script
npx wrangler r2 object put "${BUCKET}/bundles/${VERSION}/worker.js" \
  --file="$BUNDLE_FILE" \
  --content-type="application/javascript"

# Upload migrations
MIGRATIONS_TMPFILE=$(mktemp)
echo "$MIGRATIONS_JSON" > "$MIGRATIONS_TMPFILE"
npx wrangler r2 object put "${BUCKET}/bundles/${VERSION}/migrations.json" \
  --file="$MIGRATIONS_TMPFILE" \
  --content-type="application/json"

# Upload manifest
MANIFEST_TMPFILE=$(mktemp)
echo "{\"version\":\"${VERSION}\",\"migrations\":$MIGRATIONS_JSON,\"createdAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > "$MANIFEST_TMPFILE"
npx wrangler r2 object put "${BUCKET}/bundles/${VERSION}/manifest.json" \
  --file="$MANIFEST_TMPFILE" \
  --content-type="application/json"

# Cleanup
rm -f "$MIGRATIONS_TMPFILE" "$MANIFEST_TMPFILE"

echo "=== Bundle v${VERSION} uploaded successfully ==="
echo "  Script: bundles/${VERSION}/worker.js"
echo "  Migrations: bundles/${VERSION}/migrations.json (${MIGRATION_COUNT} files)"
echo "  Manifest: bundles/${VERSION}/manifest.json"
