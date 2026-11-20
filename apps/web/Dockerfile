# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci -w apps/web --include-workspace-root=false
COPY apps/web apps/web
# Map tiles: the public OpenStreetMap servers are fine for demos but their usage
# policy forbids heavy production use. Point these at your tile provider.
ARG VITE_MAP_TILE_URL
ARG VITE_MAP_ATTRIBUTION
ENV VITE_MAP_TILE_URL=$VITE_MAP_TILE_URL VITE_MAP_ATTRIBUTION=$VITE_MAP_ATTRIBUTION
RUN npm run build -w apps/web

# Unprivileged nginx: runs as a non-root user and listens on 8080.
FROM nginxinc/nginx-unprivileged:1.27-alpine
ENV MAP_TILE_ORIGINS="https://*.tile.openstreetmap.org"
COPY apps/web/nginx/ /etc/nginx/templates/
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
