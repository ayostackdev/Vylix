# CamPulse (monorepo)

Lightweight, multi-app workspace for the CamPulse product.

Folders of interest
- `apps/web` — Next.js frontend
- `apps/api` — NestJS backend (Prisma schema + migrations)
- `apps/python-service` — FastAPI support service for document workflows
- `docs/` — project documentation and deployment guides

Quick start (developer)
1. Install root workspace deps: `npm install`
2. Copy env examples into local env files (do not commit secrets):
   - `apps/web/.env.example` -> `apps/web/.env.local`
   - `apps/api/.env.example` -> `apps/api/.env`
3. Generate Prisma client: `npm run prisma:generate -w @campulse/api`
4. Run services:
   - API: `npm run dev:api`
   - Web: `npm run dev:web`
   - Python service: `cd apps/python-service && uvicorn app.main:app --reload`

More docs: see `docs/README.md` for architecture and deployment guides.
