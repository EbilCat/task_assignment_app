# syntax=docker/dockerfile:1
# Backend image: build the TypeScript in one stage, run plain JS in another.
# Build from backend/:  docker build -t task-assignment-api .

# ---- 1. deps: every dependency (dev too: we need typescript to build) ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- 2. build: compile src/ -> dist/ (demos excluded by tsconfig.build.json) ----
FROM deps AS build
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# ---- 3. prod-deps: only "dependencies" (no tsx, typescript, vitest...) ----
FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---- 4. runtime: the only stage that ships ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY package.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
# Liveness only (is the process answering?). Whether Postgres is up is
# GET /health/db's job, and compose will order startup on the db's own check.
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
# Exec form: node is PID 1 and receives SIGTERM itself, so server.ts's
# graceful shutdown (server.close -> pool.end) runs on docker stop.
CMD ["node", "--enable-source-maps", "dist/server.js"]