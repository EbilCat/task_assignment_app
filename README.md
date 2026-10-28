# Task Assignment

A small full-stack app for creating tasks (with nested subtasks), assigning
them to developers who have the right skills, and moving them through
`To Do -> In Progress -> Done`. When a task is created without skills, the
backend asks Gemini to suggest them from the title.

- **Backend:** Node.js 22 + TypeScript, Express 5, PostgreSQL 16 (`pg`), zod
- **Frontend:** React 19 + TypeScript (Vite), TanStack Query
- **LLM:** Google Gemini via `@google/genai` (optional; the app works without a key)
- **Runs with:** Docker + docker compose (three services: `db`, `api`, `web`)

## Quick start

Requirements: Docker with the compose plugin (Docker Desktop, Rancher Desktop
or similar). Nothing else: no Node, no Postgres on your machine.

```bash
git clone <repo-url> task-assignment
cd task-assignment

# Optional: enable LLM skill inference
cp .env.example .env        # then set GEMINI_API_KEY=... in .env

docker compose up --build   # first run builds both images (a few minutes)
```

Open **http://localhost:8080**.

- Without a `.env` every setting has a default; skill inference is skipped
  and the form says "Skill suggestions were skipped (no_key)".
- Get a free Gemini key at https://aistudio.google.com ("Get API key").
- `docker compose up --build -d --wait` runs it in the background and returns
  when all three services are healthy. `docker compose down` stops it (data
  kept); `docker compose down -v` also wipes the database, so the seed runs
  again on the next start.
- Port 8080 or 5432 already in use? Set `WEB_PORT` / `POSTGRES_PORT` in `.env`.

> **Credentials:** the database user/password (`app` / `app`) and every value
> in `.env.example` are for **local development only**. Do not use them in any
> shared or production environment. In production the secrets would come from
> a secret manager (injected as environment variables at run time, never baked
> into an image), and the API would connect with a least-privilege database
> role rather than the owner account.

### Seed data

| Developer | Skills |
|---|---|
| 1 Alice | Frontend |
| 2 Bob | Backend |
| 3 Carol | Frontend, Backend |
| 4 Dave | Backend |

Tasks: #1 Build login page (FE+BE) with subtasks #2 Design form UI (FE) and
#3 Auth API endpoint (BE), which has subtask #4 Hash passwords (BE);
#5 Write README (no skills).

## Features

- **Task list** (`#/`): every task as a card with its subtasks nested below,
  an assignee dropdown showing only qualified developers, and a status select.
- **Task creation** (`#/new`): title, skills, assignee and status, plus
  subtasks to any depth ("+ Add subtask" on every node). The whole tree is
  saved in one request.
- **Business rules**, enforced by the API (the UI shows the API's message
  under the field it refers to):
  1. A task can only be assigned to a developer who has **all** of its
     required skills. A task with no skills can go to anyone.
  2. A task can only be **Done** when all of its subtasks (at every level)
     are Done. Reopening a subtask of a Done task is refused too ("reopen the
     parent first"), so a Done task never has unfinished work below it.
- **Skill inference**: tasks submitted with no skills ticked get skills
  suggested by Gemini from the title (one call per request for the whole
  tree). Ticked skills are never overwritten. If Gemini is not configured,
  slow or returns something invalid, the task is saved without skills.

## System design

```
 Browser ──http://localhost:8080──▶ web (nginx)
                                     ├─ /            static React build (dist/)
                                     └─ /api/*  ──▶  api (Express, :3000, not published)
                                                      ├─▶ db (Postgres 16, volume pgdata)
                                                      └─▶ Gemini API (optional, HTTPS)
```

- **Same origin everywhere.** The SPA calls relative `/api/...` URLs. In
  Docker nginx proxies `/api/` to `http://api:3000/` (prefix stripped); in
  development Vite's dev server does the same. So there is no CORS
  configuration and no backend URL baked into the bundle: one image works on
  any host.
- **Startup order:** `db` (healthy when `pg_isready` passes) -> `api`
  (healthy when `GET /health` answers) -> `web`, using `depends_on` with
  `condition: service_healthy`. Only `web` (8080) and `db` (5432, for local
  tools) are published.
- **Backend layers** (imports only point down):
  - `routes/` HTTP only: parse input with zod, call one service, send the
    response or throw an `ApiError`.
  - `services/` business logic and both rules; no HTTP types.
  - `repositories/` SQL only, parameterised (`$1`), taking a `db` argument so
    the same functions run on the pool or inside a transaction.
  - `rules.ts` the rules as pure functions (unit-tested without a database).
  - `errors.ts` + one error handler in `app.ts` produce every error response.
- **Data model** (`db/init/001_schema.sql`): `developers`, `skills`,
  `developer_skills` (many-to-many), `tasks` (subtasks via a self-referencing
  `parent_task_id`, any depth, `ON DELETE CASCADE`), `task_skills`. Status is
  `text` with a `CHECK`. Foreign-key columns are indexed.
- **Why the rules are in the service, not the database:** a `CHECK`
  constraint can only see the row being written, and both rules depend on
  other rows (the developer's skills; every task below). The service checks
  them with one query each: a double `NOT EXISTS` for "has every required
  skill" and a `WITH RECURSIVE` query counting unfinished descendants.
- **Creating a tree:** `POST /tasks` validates the whole body, checks that
  skills and developers exist, applies rule 2 in memory, fills missing skills
  with one Gemini call, applies rule 1, then inserts every node in **one
  transaction**: either the whole tree is saved or nothing is.
- **LLM call:** only `src/llm/` talks to Gemini. It asks for structured JSON
  whose skills must be names from the `skills` table (an enum built per
  call), validates the answer with zod, uses temperature 0 and an 8 s
  timeout, and never throws: any failure becomes a reason code
  (`no_key`, `timeout`, `api_error`, `bad_json`, ...) and the request carries
  on without inferred skills. The task title is passed as data, not as
  instructions. The key lives only in the backend's environment.

## API

Base URL: `http://localhost:8080/api` (through nginx). All bodies are JSON;
send `Content-Type: application/json` on writes. Lists are wrapped in an
object (`{ "tasks": [...] }`) so fields can be added later.

| Method | Path | Body | Success |
|---|---|---|---|
| GET | `/tasks` | | `200 { tasks }` top-level tasks, each with nested `subtasks` |
| GET | `/tasks/:id` | | `200 { task }` that task and its subtree |
| POST | `/tasks` | task tree (below) | `201 { task, inference }` + `Location: /tasks/:id` |
| GET | `/tasks/:id/qualified-developers` | | `200 { taskId, developers }` developers with all required skills |
| PATCH | `/tasks/:id/assignee` | `{ "assigneeId": 3 }` or `{ "assigneeId": null }` | `200 { task }` |
| PATCH | `/tasks/:id/status` | `{ "status": "Done" }` | `200 { task }` |
| GET | `/developers` | | `200 { developers }` each with `skills: string[]` |
| GET | `/skills` | | `200 { skills }` alphabetical |
| GET | `/health` | | `200 { status: "ok", uptimeSeconds }` process is up (no DB) |
| GET | `/health/db` | | `200 { db: "up", latencyMs }` or `503 { db: "down" }` |

A task looks like:

```json
{ "id": 3, "title": "Auth API endpoint", "status": "In Progress",
  "assigneeId": 2, "parentTaskId": 1, "skills": ["Backend"],
  "subtasks": [ { "id": 4, "title": "Hash passwords", "...": "..." } ] }
```

`POST /tasks` body (every field except `title` is optional; `subtasks` nest
to any depth, max 20 per level; skills are names from `GET /skills`):

```json
{
  "title": "Build signup page",
  "skills": ["Frontend", "Backend"],
  "assigneeId": 3,
  "status": "To Do",
  "subtasks": [
    { "title": "Signup form", "skills": ["Frontend"], "assigneeId": 1 },
    { "title": "Signup API",
      "subtasks": [ { "title": "Validate email" } ] }
  ]
}
```

Here "Signup API" and "Validate email" have no skills, so they are inferred.
`inference` in the response is one of `{ "status": "skipped" }`,
`{ "status": "ok", "inferred": [{ "path", "title", "skills" }], "ms" }` or
`{ "status": "failed", "reason", "ms" }`.

```bash
curl -s localhost:8080/api/tasks
curl -s -X PATCH localhost:8080/api/tasks/3/assignee \
  -H 'Content-Type: application/json' -d '{"assigneeId":1}'   # 422: Alice lacks Backend
```

### Errors

Every error has the same body; `details` is always an array, and `path`
points at the field to blame (dotted for nested subtasks, e.g.
`subtasks.1.assigneeId`).

```json
{ "error": { "code": "NOT_QUALIFIED",
             "message": "assigneeId: Alice lacks required skill: Backend",
             "details": [ { "path": "assigneeId", "message": "Alice lacks required skill: Backend" } ] } }
```

| Code | Status | When |
|---|---|---|
| `BAD_REQUEST` | 400 | Invalid input, or it names a skill/developer that doesn't exist |
| `BAD_JSON` | 400 | The body is not valid JSON |
| `NOT_FOUND` | 404 | Unknown route or task id |
| `NOT_QUALIFIED` | 422 | Rule 1: the assignee lacks a required skill |
| `SUBTASKS_NOT_DONE` | 422 | Rule 2: Done while a subtask (any depth) isn't |
| `PARENT_DONE` | 422 | Rule 2: reopening a task whose parent/ancestor is Done |
| `INTERNAL` | 500 | Unexpected error (details only in the server log) |

400 = the request is malformed; 422 = the request is valid but breaks a
business rule.

## Development without Docker for the app

```bash
cp .env.example .env
docker compose up -d db                 # Postgres only, on localhost:5432
cd backend  && npm ci && npm run dev    # http://localhost:3000
cd frontend && npm ci && npm run dev    # http://localhost:5173 (proxies /api)
```

## Running tests

```bash
docker compose up -d db
cd backend && npm ci && npm test        # 46 tests (vitest + supertest)
```

The tests reset the **local** database to the seed before each test (they
refuse to run against a non-localhost `DATABASE_URL`) and never call the real
Gemini API (it is mocked). They cover both rules as pure functions and over
HTTP, the qualified-developers query against the rule function, and the
inference fallbacks. `npm run typecheck` / `npm run typecheck:test` type-check
the code and tests.

## Project layout

```
docker-compose.yml   db + api + web
db/init/             001_schema.sql, 002_seed.sql (run on an empty volume)
backend/             Express API (src/routes, services, repositories, llm), tests in test/
frontend/            React SPA (src/pages, components, api), nginx.conf
```

## Known limitations and next steps

- **No authentication or authorisation**; anyone who can reach the app can
  change any task.
- **Check-then-write without locks:** assigning and changing status check a
  rule and then update outside a transaction. Fine for a single user; under
  concurrency the fix is a transaction with `SELECT ... FOR UPDATE` on the
  task (and its ancestors for rule 2).
- **No pagination** on `GET /tasks`; the whole tree is returned.
- **No cycle guard** in the recursive queries: tasks can't be re-parented
  through the API, so cycles can't be created, but a moving-tasks feature
  would need one.
- **Inferred skills are stored like ticked ones** (no "suggested" flag), and
  editing a task's skills isn't supported.
- **Frontend types are a hand-kept copy** of the backend's response types
  (a shared package was more wiring than the deadline allowed).
- **Hardening not done:** nginx runs as root (`nginx-unprivileged` is the
  next step), no restart policies, images built for the local architecture
  (`docker buildx --platform linux/amd64` for a cloud deploy), schema created
  by init scripts rather than a migration tool.