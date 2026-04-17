#!/bin/bash
set -e

COMPOSE_FILE="Infrastructure/docker-compose.yml"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
MIN_FREE_KB=$((4 * 1024 * 1024)) # 4 GB
PRUNE_INTERVAL_SECONDS=$((24 * 60 * 60))
PRUNE_STAMP_FILE="/tmp/seo-mini-tool-docker-prune.stamp"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "$SCRIPT_DIR/Infrastructure/lib/deploy-common.sh"

load_env_file() {
  local env_file="$1"

  if [ -f "$env_file" ]; then
    echo "🔁 Loading ${env_file}"
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
  fi
}

cd "$SCRIPT_DIR"

load_env_file "Infrastructure/.env"

echo "🧹 Cleaning up stopped containers and unused images (volumes stay safe)..."
docker compose -f "$COMPOSE_FILE" down --remove-orphans || true

maybe_prune
sync_repo

load_env_file "Infrastructure/.env"

echo "📦 Pulling infrastructure images"
docker compose -f "$COMPOSE_FILE" pull caddy

echo "🐳 Rebuilding application image"
docker_compose_build_with_cache_repair "$COMPOSE_FILE" --pull app

echo "🚀 Starting stack"
docker compose -f "$COMPOSE_FILE" up -d app caddy

echo "✅ Deploy completed"
docker compose -f "$COMPOSE_FILE" ps
