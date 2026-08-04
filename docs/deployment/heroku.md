# Deployment (Heroku retired)

Heroku is no longer used for Vylix.

- **Web app** (`apps/web`): deployed to Vercel. Push to `main` (or run `vercel --prod` from `apps/web`).
- **API + workers** (`apps/api`): deployed to Render via `render.yaml` (web, Celery worker, Celery beat).

See `render.yaml` in the repo root for the API deployment configuration.
