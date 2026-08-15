#!/usr/bin/env bash
#
# Give one session its own git worktree, sharing the turbo cache with every
# other worktree.
#
#   scripts/session-worktree.sh                  link this worktree to the
#                                                shared turbo cache (idempotent)
#   scripts/session-worktree.sh <branch> [dir]   create a worktree for <branch>,
#                                                link the cache, install deps
#
# Why: `turbo --affected` and `vitest --changed` both derive their scope from
# the git diff of the working tree they run in. When several sessions edit one
# shared tree, every session's "affected" set contains every other session's
# work, so the incremental scope collapses back to something close to a full
# run. A worktree per session restores the isolation.
#
# The turbo cache is deliberately NOT isolated: it is content-addressed, so
# sharing it means a package another session already typechecked or tested at
# the exact same content hash is a cache hit here for free. Without the link,
# every worktree starts from an empty cache and pays full price.

set -euo pipefail

# git-common-dir points at the ONE real .git directory, so this resolves to the
# primary worktree no matter which worktree the script is invoked from.
GIT_COMMON_DIR="$(git rev-parse --path-format=absolute --git-common-dir)"
PRIMARY_ROOT="$(dirname "$GIT_COMMON_DIR")"

SHARED_CACHE="${MAKAN_TURBO_CACHE_DIR:-$HOME/.cache/turbo/makanmasak}"

log() { printf '  %s\n' "$*"; }

# Point <worktree>/.turbo/cache at the shared directory, preserving whatever is
# already cached there.
link_cache() {
  local root="$1"
  local cache="$root/.turbo/cache"

  mkdir -p "$SHARED_CACHE"

  if [ -L "$cache" ]; then
    local current
    current="$(readlink "$cache")"
    if [ "$current" = "$SHARED_CACHE" ]; then
      log "turbo cache: already shared -> $SHARED_CACHE"
      return 0
    fi
    log "turbo cache: repointing $current -> $SHARED_CACHE"
    rm "$cache"
  elif [ -d "$cache" ]; then
    # Migrate, don't discard: these entries cost real CPU to produce. Existing
    # names in the shared dir win, since identical hashes are identical output.
    local n
    n="$(find "$cache" -mindepth 1 -maxdepth 1 | wc -l | tr -d ' ')"
    log "turbo cache: migrating $n existing entries into $SHARED_CACHE"
    if [ "$n" != "0" ]; then
      cp -Rn "$cache"/. "$SHARED_CACHE"/ 2>/dev/null || true
    fi
    rm -rf "$cache"
  fi

  mkdir -p "$root/.turbo"
  ln -s "$SHARED_CACHE" "$cache"
  log "turbo cache: $cache -> $SHARED_CACHE"
}

# Gitignored local state lives only in the primary worktree. A fresh worktree
# without it silently falls back to defaults (no secrets, an empty local D1),
# which reads as "my environment is broken" rather than "it was never linked".
#
# Directories are mirrored as a real directory of symlinked children rather than
# one symlink to the directory. .gitignore lists `.wrangler/` with a trailing
# slash, which matches a directory but NOT a symlink pointing at one, so the
# single-symlink form shows up as an untracked `.wrangler` in every `git status`
# and is one `git add -A` away from being committed.
link_local_state() {
  local root="$1"
  if [ "$root" = "$PRIMARY_ROOT" ]; then
    return 0
  fi

  local item
  for item in .env.local .wrangler; do
    local src="$PRIMARY_ROOT/$item"
    local dst="$root/$item"
    if [ ! -e "$src" ]; then
      continue
    fi
    if [ -e "$dst" ] || [ -L "$dst" ]; then
      log "local state: $item already present, leaving it alone"
      continue
    fi
    if [ -d "$src" ]; then
      mkdir -p "$dst"
      local child
      for child in "$src"/*; do
        [ -e "$child" ] || continue
        ln -s "$child" "$dst/$(basename "$child")"
      done
      log "local state: $item/* -> $src/* (real dir, symlinked children)"
    else
      ln -s "$src" "$dst"
      log "local state: $item -> $src"
    fi
  done
}

if [ $# -eq 0 ]; then
  ROOT="$(git rev-parse --show-toplevel)"
  echo "Linking $(basename "$ROOT") to the shared turbo cache"
  link_cache "$ROOT"
  exit 0
fi

BRANCH="$1"
DIR="${2:-$PRIMARY_ROOT-$(printf '%s' "$BRANCH" | tr '/' '-')}"

if [ -e "$DIR" ]; then
  echo "error: $DIR already exists" >&2
  exit 1
fi

BASE="origin/main"
git rev-parse --verify --quiet "$BASE" >/dev/null || BASE="main"

echo "Creating worktree"
log "branch: $BRANCH"
log "dir:    $DIR"
log "base:   $BASE"

if git rev-parse --verify --quiet "refs/heads/$BRANCH" >/dev/null; then
  git worktree add "$DIR" "$BRANCH"
else
  git worktree add -b "$BRANCH" "$DIR" "$BASE"
fi

link_cache "$DIR"
link_local_state "$DIR"

echo "Installing dependencies (hardlinked from the pnpm store, not re-downloaded)"
(cd "$DIR" && pnpm install --prefer-offline)

cat <<EOF

Ready. Work in this session from:

  cd $DIR

Inner loop in there (scope is now this session's diff only):

  pnpm verify           # affected typecheck + lint + test
  pnpm verify:push      # the full gate, once, before pushing

When the branch is done:

  git worktree remove $DIR
EOF
