FROM node:22-bookworm-slim AS base

WORKDIR /app

COPY App/package*.json ./
RUN npm ci --omit=dev

COPY App/ ./

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]
