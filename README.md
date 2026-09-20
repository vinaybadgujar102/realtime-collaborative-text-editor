# Realtime Collaborative Text Editor

Bun + Turborepo monorepo with a REST API, WebSocket/Yjs sync server, and TanStack Start frontend.

## Apps

| App | Path | Role |
|-----|------|------|
| `web` | [`apps/web`](apps/web) | TanStack Start UI (auth, documents, Quill + Yjs editor) |
| `apiServer` | [`apps/apiServer`](apps/apiServer) | Express REST API (`/api/v1`) |
| `wsServer` | [`apps/wsServer`](apps/wsServer) | WebSocket server for live Yjs updates |

## Packages

- `@repo/database` — Prisma + PostgreSQL
- `@repo/ui` — stub React library (unused by web; shadcn lives in `apps/web`)
- `@repo/eslint-config` / `@repo/typescript-config` — shared tooling

## Quick start

```bash
bun install
```

### Backend

1. Ensure Postgres and Redis are running.
2. Configure `apps/apiServer` env (`PORT=3000`, `JWT_SECRET=SECRET`, `DATABASE_URL=...`).
   - Use `JWT_SECRET=SECRET` so WS auth matches the hardcoded secret in `wsServer`.
3. Start services:

```bash
bun run dev:api   # REST API → http://localhost:3000
bun run dev:ws    # WebSocket → ws://localhost:8080
```

### Frontend

```bash
cp apps/web/.env.example apps/web/.env
bun run dev:web   # → http://localhost:5173
```

See [`apps/web/README.md`](apps/web/README.md) for frontend details.

## Scripts

| Script | Description |
|--------|-------------|
| `bun run dev:web` | Start TanStack Start app |
| `bun run dev:api` | Start API server |
| `bun run dev:ws` | Start WebSocket server |
| `bun run build` | Build all packages via Turbo |
