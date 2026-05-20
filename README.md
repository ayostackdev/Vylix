# CamPulse v2.0 Monorepo

CamPulse is scaffolded as a multi-app workspace with Nest.js as the main backend and a FastAPI Python support service for AI/document workflows:

- apps/web: Next.js 14 App Router client with Tailwind UI foundation and offline-first query persistence.
- apps/api: Nest.js feature-based backend with Prisma schema, tenant middleware, department guard, telemetry gateway, and maintenance cron.
- apps/python-service: auxiliary FastAPI service for document intelligence, OCR, RAG scaffolding, analytics, Celery tasks, and PDF compression.
- docs/fastapi-microservice.md: architecture notes for the Python support service stack and workflow.

## Architecture highlights

- Dual-layer dashboard with Private Vault and Public Pulse in the frontend.
- IndexedDB persistence for TanStack Query cache.
- Shared-schema multi-tenancy boundary via request context + guard checks.
- Feature modules for colleges, topics, telemetry, and maintenance.
- Dynamic academic level utility for FUNAAB session logic.
- Python support service scaffold for document ingestion, semantic search, OCR, analytics, and compressed PDF storage.

## Quick start

1. Install dependencies:
   npm install
2. Copy env templates:
   - apps/web/.env.example -> apps/web/.env.local
   - apps/api/.env.example -> apps/api/.env
3. Set your PostgreSQL connection in apps/api/.env.
4. Generate Prisma client:
   npm run prisma:generate -w @campulse/api
5. Run backend:
   npm run dev:api
6. Run frontend:
   npm run dev:web
7. Run the Python service:
   cd apps/python-service
   uvicorn app.main:app --reload

## Build verification

- Frontend production build: npm run build -w @campulse/web
- Backend production build: npm run build -w @campulse/api
