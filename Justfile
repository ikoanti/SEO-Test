set shell := ["zsh", "-cu"]

default:
	@just --list

install:
	cd App && npm install

dev:
	node --experimental-strip-types scripts/dev-local.ts --reset

dev-reset:
	node --experimental-strip-types scripts/dev-local.ts --reset

dev-keep:
	node --experimental-strip-types scripts/dev-local.ts
