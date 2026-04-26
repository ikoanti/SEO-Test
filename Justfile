set shell := ["zsh", "-cu"]

default:
	@just --list

install:
	cd App && npm install

dev:
	docker compose -f Infrastructure/docker-compose.yml -f Infrastructure/docker-compose.dev.yml --env-file Infrastructure/.env down -v --remove-orphans
	docker compose -f Infrastructure/docker-compose.yml -f Infrastructure/docker-compose.dev.yml --env-file Infrastructure/.env up --build

dev-reset:
	docker compose -f Infrastructure/docker-compose.yml -f Infrastructure/docker-compose.dev.yml --env-file Infrastructure/.env down -v --remove-orphans
	docker compose -f Infrastructure/docker-compose.yml -f Infrastructure/docker-compose.dev.yml --env-file Infrastructure/.env up --build

dev-keep:
	docker compose -f Infrastructure/docker-compose.yml -f Infrastructure/docker-compose.dev.yml --env-file Infrastructure/.env up --build

down:
	docker compose -f Infrastructure/docker-compose.yml -f Infrastructure/docker-compose.dev.yml --env-file Infrastructure/.env down --remove-orphans
