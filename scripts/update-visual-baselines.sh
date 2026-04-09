#!/usr/bin/env bash
#
# Regenerate Playwright visual regression baselines in a Linux environment
# that exactly matches the CI runner (ubuntu-latest / amd64).
#
# Why: Playwright screenshot comparison is byte-fragile. macOS fonts, subpixel
# antialiasing, and emoji rendering produce different PNGs than Linux, so any
# baseline committed from `pnpm test:visual:update` run on a Mac will never
# match CI. This script runs the exact CI flow inside the pinned Playwright
# Docker image and syncs only the *-snapshots/ directories back to the repo.
#
# Requirements:
#   - Docker (or OrbStack) with amd64 support
#   - Free ports 3000, 3001, 3002, 3010, 3011 inside the container
#
# Usage:
#   ./scripts/update-visual-baselines.sh              # full regen
#   ./scripts/update-visual-baselines.sh --fast       # reuse cached scratch dir
#

set -euo pipefail

# ----------------------------------------------------------------------------
# Config — must match .github/workflows/test.yml visual-regression-tests job
# and the @playwright/test version in package.json
# ----------------------------------------------------------------------------
PLAYWRIGHT_VERSION="1.57.0"
IMAGE="mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble"
PNPM_VERSION="10.24.0"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRATCH_DIR="${HOME}/.cache/makan-visual-baselines"

FAST_MODE=false
if [[ "${1:-}" == "--fast" ]]; then
  FAST_MODE=true
fi

# ----------------------------------------------------------------------------
# Pretty logging
# ----------------------------------------------------------------------------
log() { printf '\033[1;34m[baseline]\033[0m %s\n' "$*"; }
ok()  { printf '\033[1;32m[baseline]\033[0m %s\n' "$*"; }
warn(){ printf '\033[1;33m[baseline]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[baseline]\033[0m %s\n' "$*" >&2; exit 1; }

# ----------------------------------------------------------------------------
# Preflight
# ----------------------------------------------------------------------------
command -v docker >/dev/null || die "docker not found (install Docker Desktop or OrbStack)"
docker info >/dev/null 2>&1 || die "docker daemon not responding"
command -v rsync  >/dev/null || die "rsync not found"

log "Playwright image:  ${IMAGE}"
log "pnpm version:      ${PNPM_VERSION}"
log "Repo root:         ${REPO_ROOT}"
log "Scratch dir:       ${SCRATCH_DIR}"
log "Fast mode:         ${FAST_MODE}"

# ----------------------------------------------------------------------------
# 1. Sync source into scratch dir (exclude node_modules & build artifacts so
#    we don't mix macOS and Linux binaries)
# ----------------------------------------------------------------------------
mkdir -p "${SCRATCH_DIR}"

log "Syncing source into scratch dir (this preserves host node_modules)..."
# Exclusions matter: we must NOT carry over any build artifact or incremental
# build state from the host (macOS) into the container (Linux). In particular
# tsconfig.tsbuildinfo tricks TS composite builds into skipping emit, which
# then causes turbo to report "no output files found" for shared packages.
rsync -a --delete \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.turbo' \
  --exclude='dist' \
  --exclude='build' \
  --exclude='.output' \
  --exclude='.next' \
  --exclude='*.tsbuildinfo' \
  --exclude='.wrangler' \
  --exclude='.cache' \
  --exclude='playwright-report' \
  --exclude='test-results' \
  --exclude='coverage' \
  --exclude='.gstack-reports' \
  "${REPO_ROOT}/" "${SCRATCH_DIR}/"

# Belt-and-braces: if the scratch dir already had leftover tsbuildinfo or
# dist from a previous failed run, wipe them so tsc rebuilds cleanly.
find "${SCRATCH_DIR}" -type f -name '*.tsbuildinfo' -delete 2>/dev/null || true
find "${SCRATCH_DIR}/packages" -type d -name 'dist' -prune -exec rm -rf {} + 2>/dev/null || true
find "${SCRATCH_DIR}/apps" -type d -name 'dist' -prune -exec rm -rf {} + 2>/dev/null || true

# ----------------------------------------------------------------------------
# 2. Pull pinned image
# ----------------------------------------------------------------------------
log "Pulling ${IMAGE} (amd64)..."
docker pull --platform linux/amd64 "${IMAGE}" >/dev/null

# ----------------------------------------------------------------------------
# 3. Run install + build + preview + visual test --update-snapshots inside
#    the pinned container.
# ----------------------------------------------------------------------------
log "Launching container..."

docker run --rm -i \
  --platform linux/amd64 \
  --ipc=host \
  -v "${SCRATCH_DIR}:/work" \
  -w /work \
  -e CI=true \
  -e PNPM_VERSION="${PNPM_VERSION}" \
  "${IMAGE}" \
  bash -euo pipefail <<'CONTAINER_SCRIPT'
echo "[container] node:    $(node --version)"
echo "[container] os:      $(uname -a)"

echo "[container] Enabling corepack + pnpm ${PNPM_VERSION}..."
corepack enable
corepack prepare "pnpm@${PNPM_VERSION}" --activate

echo "[container] Installing dependencies (frozen lockfile)..."
pnpm install --frozen-lockfile

echo "[container] Clearing turbo cache (avoids poisoned 'no output files' entries)..."
rm -rf node_modules/.cache/turbo .turbo || true

echo "[container] Building 5 frontend apps (and their deps via turbo graph)..."
# Scoped build: visual regression only needs the 5 frontend preview servers.
# Avoids a pre-existing fresh-install TS error in @makanmakan/realtime that
# is unrelated to visual tests.
# --force: bypass any remaining turbo cache since we need a real fresh build
# (shared-types must actually emit dist/ so downstream tsc can resolve it).
#
# VITE_API_BASE_URL: customer-app's src/services/api.ts throws at module init
# if this env var is unset. We use a relative "/api/v1" so requests go to the
# same origin as the preview server — this is important because the
# customer-app ships a strict CSP meta tag with
# `connect-src 'self' https: wss: https://*.makanmakan.app`. An absolute URL
# like `http://mock.local/api/v1` would be blocked by CSP BEFORE Playwright
# can intercept it, so the mock would never fire and every page would render
# "Loading failed" no matter how the mocks are configured.
VITE_API_BASE_URL="/api/v1" \
pnpm build --force \
  --filter=makanmakan-customer-app \
  --filter=makanmakan-admin-dashboard \
  --filter=makanmakan-kitchen-display \
  --filter=makanmakan-management-portal \
  --filter=makanmakan-onboarding-app

echo "[container] Starting preview servers..."
mkdir -p /tmp/preview-logs
(cd apps/customer-app       && npx vite preview --port 3000  --host 0.0.0.0 > /tmp/preview-logs/customer.log   2>&1) &
(cd apps/admin-dashboard    && npx vite preview --port 3001  --host 0.0.0.0 > /tmp/preview-logs/admin.log      2>&1) &
(cd apps/kitchen-display    && npx vite preview --port 3002  --host 0.0.0.0 > /tmp/preview-logs/kitchen.log    2>&1) &
(cd apps/management-portal  && npx vite preview --port 3010  --host 0.0.0.0 > /tmp/preview-logs/management.log 2>&1) &
(cd apps/onboarding-app     && npx vite preview --port 3011  --host 0.0.0.0 > /tmp/preview-logs/onboarding.log 2>&1) &

echo "[container] Waiting for servers (up to 120s)..."
npx wait-on \
  http://localhost:3000 \
  http://localhost:3001 \
  http://localhost:3002 \
  http://localhost:3010 \
  http://localhost:3011 \
  --timeout 120000

echo "[container] Regenerating visual baselines (--update-snapshots)..."
npx playwright test --config playwright.visual.config.ts --update-snapshots

echo "[container] Done."
CONTAINER_SCRIPT

# ----------------------------------------------------------------------------
# 4. Sync only the *-snapshots/ directories back to the real repo
# ----------------------------------------------------------------------------
log "Syncing new baselines back to repo..."

# Find all *-snapshots directories under tests/visual inside scratch
while IFS= read -r -d '' snap_dir; do
  rel="${snap_dir#${SCRATCH_DIR}/}"
  target="${REPO_ROOT}/${rel}"
  mkdir -p "${target}"
  rsync -a --delete "${snap_dir}/" "${target}/"
  ok "  $(basename "${rel}") → ${rel}"
done < <(find "${SCRATCH_DIR}/tests/visual" -type d -name '*-snapshots' -print0)

# ----------------------------------------------------------------------------
# 5. Guard: ensure we only produced *-linux.png, not *-darwin.png or *-win32.png
# ----------------------------------------------------------------------------
log "Verifying only Linux baselines were produced..."
WRONG_PLATFORM=$(find "${REPO_ROOT}/tests/visual" \
  -type f \( -name '*-darwin.png' -o -name '*-win32.png' \) \
  | wc -l | tr -d ' ')

if [[ "${WRONG_PLATFORM}" != "0" ]]; then
  warn "Found ${WRONG_PLATFORM} wrong-platform baselines still in repo:"
  find "${REPO_ROOT}/tests/visual" \
    -type f \( -name '*-darwin.png' -o -name '*-win32.png' \)
  warn "Delete these before committing (they are stale)."
fi

LINUX_COUNT=$(find "${REPO_ROOT}/tests/visual" -type f -name '*-linux.png' | wc -l | tr -d ' ')
ok "Produced ${LINUX_COUNT} *-linux.png baselines."
ok "Review the diff with: git status tests/visual"
ok "Commit with:          git add tests/visual && git commit"
