# syntax=docker/dockerfile:1
# Frontend image: build the SPA with Node, serve the files with nginx.
# Build from frontend/:  docker build -t task-assignment-web .

# ---- 1. build: npm ci, then tsc -b + vite build -> dist/ ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- 2. runtime: just nginx + the built files (no Node, no node_modules) ----
FROM nginx:1.27-alpine AS runtime
# Replace nginx's default site with ours (static files + /api proxy)
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
# Liveness: can nginx serve index.html? (busybox wget ships with alpine)
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
# The nginx base image's CMD (nginx -g "daemon off;") is kept: exec form,
# foreground, so docker stop's SIGTERM reaches nginx directly.