#!/bin/bash

safe_prune() {
  echo "🧹 Safe Docker prune (old unused images/build cache, keep volumes)"
  docker image prune -af --filter "until=168h" || true
  docker builder prune -af --filter "until=168h" || true
  docker container prune -f || true
  docker network prune -f || true
}

aggressive_prune() {
  echo "🧨 Low disk detected, running aggressive prune (still keeping volumes)"
  docker image prune -af || true
  docker builder prune -af || true
  docker container prune -f || true
  docker network prune -f || true
}

repair_buildkit_cache() {
  echo "🧹 Clearing Docker builder cache to avoid BuildKit snapshot corruption"
  docker builder prune -af || true
}

is_buildkit_snapshot_error() {
  local log_file="$1"
  grep -Eiq 'failed to prepare extraction snapshot|parent snapshot .* does not exist|does not exist: not found' "$log_file"
}

docker_compose_build_with_cache_repair() {
  local compose_file="$1"
  shift

  local build_log
  build_log="$(mktemp -t seo-mini-tool-build.XXXXXX.log)"

  repair_buildkit_cache

  if docker compose -f "$compose_file" build "$@" 2>&1 | tee "$build_log"; then
    rm -f "$build_log"
    return 0
  fi

  if is_buildkit_snapshot_error "$build_log"; then
    echo "⚠️ BuildKit snapshot cache is corrupt. Clearing builder cache and retrying build once..."
    repair_buildkit_cache
    rm -f "$build_log"
    docker compose -f "$compose_file" build "$@"
    return $?
  fi

  echo "❌ Docker build failed for a non-cache reason. Build log: $build_log"
  return 1
}

ensure_disk_headroom() {
  local free_kb
  free_kb=$(df -Pk . | awk 'NR==2 {print $4}')
  if [ "$free_kb" -lt "${MIN_FREE_KB}" ]; then
    aggressive_prune
  fi
}

should_prune() {
  local free_kb now last_prune
  free_kb=$(df -Pk . | awk 'NR==2 {print $4}')
  if [ "$free_kb" -lt "${MIN_FREE_KB}" ]; then
    return 0
  fi

  now=$(date +%s)
  last_prune=$(cat "${PRUNE_STAMP_FILE}" 2>/dev/null || echo 0)
  case "$last_prune" in
    ''|*[!0-9]*) last_prune=0 ;;
  esac

  [ $((now - last_prune)) -ge "${PRUNE_INTERVAL_SECONDS}" ]
}

maybe_prune() {
  if should_prune; then
    safe_prune
    ensure_disk_headroom
    date +%s > "${PRUNE_STAMP_FILE}"
  else
    echo "🧹 Skipping prune (last prune <24h and disk has enough free space)"
  fi
}

sync_repo() {
  echo "📦 Syncing repository from origin/${DEPLOY_BRANCH}..."
  git fetch origin "${DEPLOY_BRANCH}"
  git reset --hard "origin/${DEPLOY_BRANCH}"
}
