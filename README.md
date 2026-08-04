# Vylix (monorepo)

Lightweight, multi-app workspace for the Vylix product.

Folders of interest
- `apps/web` — Next.js frontend (Vercel)
- `apps/api` — FastAPI backend (Postgres + Redis + Celery, deployed on Render)
- `docs/` — project documentation and deployment guides

Quick start (developer)
1. Install root workspace deps: `npm install`
2. Copy env examples into local env files (do not commit secrets):
   - `apps/web/.env.example` -> `apps/web/.env.local`
   - `apps/api/.env.example` -> `apps/api/.env`
3. Run services:
   - API: `cd apps/api && uvicorn app.main:app --reload`
   - Web: `npm run dev:web`

Tests
- Web: `npm run test:web`
- API: `npm run test:api` (requires a reachable Postgres for the smoke tests)

More docs: see `docs/README.md` for architecture and deployment guides.
