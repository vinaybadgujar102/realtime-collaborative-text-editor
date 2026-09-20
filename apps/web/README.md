# Web (TanStack Start)

Frontend for the realtime collaborative text editor. Talks to `apiServer` (REST) and `wsServer` (Yjs updates).

## Stack

- TanStack Start + Router
- TanStack Query
- shadcn/ui + Tailwind CSS
- Quill (`react-quill` + `quill@1.3.7`) + `yjs` / `y-quill`
- Zod form validation

## Setup

```bash
# from repo root
bun install
cp apps/web/.env.example apps/web/.env
```

## Run (local)

1. Start Postgres and Redis.
2. Start the API (use `JWT_SECRET=SECRET` so WS auth matches the hardcoded WS secret):

```bash
# apps/apiServer .env should include:
# PORT=3000
# JWT_SECRET=SECRET
bun run apps/apiServer/src/index.ts
```

3. Start the WebSocket server:

```bash
bun run apps/wsServer/index.ts
```

4. Start the frontend:

```bash
cd apps/web
bun run dev
# → http://localhost:5173
```

Or from the monorepo root:

```bash
bun run dev:web
```

## Notes

- Auth token is stored in `localStorage` and sent as `Authorization: Bearer <token>`.
- WebSocket connects to `VITE_WS_URL?token=<jwt>&roomId=<documentId>`.
- Live sync is best-effort against the current WS protocol; known backend issues may prevent multi-user sync until the server is fixed separately.
