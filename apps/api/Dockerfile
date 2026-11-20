# syntax=docker/dockerfile:1.7
# Multi-stage build: compile TypeScript with dev dependencies, then ship only
# production dependencies and compiled JavaScript, running as a non-root user.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci -w apps/api --include-workspace-root=false
COPY apps/api apps/api
RUN npm run build -w apps/api

FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci -w apps/api --include-workspace-root=false --omit=dev && npm cache clean --force

FROM node:22-alpine
ENV NODE_ENV=production PORT=8000
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY apps/api/migrations ./apps/api/migrations
COPY apps/api/package.json ./apps/api/
WORKDIR /app/apps/api
RUN mkdir -p /app/uploads && chown node:node /app/uploads
USER node
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s CMD wget -qO- http://localhost:8000/health/live || exit 1
CMD ["node", "dist/server.js"]
