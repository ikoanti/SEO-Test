set shell := ["zsh", "-cu"]

compose := "docker compose -p seo-mini-tool -f Infrastructure/docker-compose.yml -f Infrastructure/docker-compose.dev.yml --env-file Infrastructure/.env"

default:
	@just --list

install:
	cd App && npm install

dev:
	{{compose}} down -v --remove-orphans
	docker rm -f seo-mini-tool-app seo-mini-tool-pocketbase seo-mini-tool-caddy 2>/dev/null || true
	docker volume rm -f seo-mini-tool_pocketbase_data infrastructure_pocketbase_data 2>/dev/null || true
	{{compose}} up --build

dev-reset:
	{{compose}} down -v --remove-orphans
	docker rm -f seo-mini-tool-app seo-mini-tool-pocketbase seo-mini-tool-caddy 2>/dev/null || true
	docker volume rm -f seo-mini-tool_pocketbase_data infrastructure_pocketbase_data 2>/dev/null || true
	{{compose}} up --build

dev-keep:
	{{compose}} up --build

down:
	{{compose}} down --remove-orphans
	docker rm -f seo-mini-tool-app seo-mini-tool-pocketbase seo-mini-tool-caddy 2>/dev/null || true
