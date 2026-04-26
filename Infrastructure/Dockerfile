FROM node:22-bookworm-slim AS system

RUN apt-get update \
	&& apt-get install -y --no-install-recommends \
		chromium \
		xvfb \
		openbox \
		ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

FROM system AS dev

WORKDIR /app

COPY App/package*.json ./
RUN npm install

COPY App/ ./

ENV NODE_ENV=development
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]

FROM system AS build

WORKDIR /app

COPY App/package*.json ./
RUN npm ci

COPY App/ ./
RUN npm run build

FROM system AS base

WORKDIR /app

COPY App/package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/build ./build
COPY App/src/lib/server/audit-capture/assets ./audit-capture-assets

ENV NODE_ENV=production
ENV PORT=3000
ENV AUDIT_CAPTURE_ASSETS_DIR=/app/audit-capture-assets

EXPOSE 3000

CMD ["node", "build"]
