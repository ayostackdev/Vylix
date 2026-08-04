# Vylix API (FastAPI)

Vylix backend: document upload and retrieval, past-questions feed, courses/topics,
auth via Supabase JWT, gamification, and AI-assisted study features.

Local setup

1. Create a Python virtualenv and install deps:
   `pip install -r requirements.txt -r requirements-dev.txt`
2. Copy `.env.example` -> `.env` and set local values (Postgres, Redis, Supabase, etc.)
3. Run: `uvicorn app.main:app --reload`

Tests

- Run the full suite: `pytest`
- Smoke tests (`tests/test_flow_smoke.py`) cover the auth -> upload -> past-questions
  flow and need a reachable Postgres; the CI workflow provisions Postgres/Redis and
  sets `SUPABASE_JWT_SECRET=test-secret-for-ci`.

Notes

- Celery is used for background tasks (requires Redis broker).
- See `docs/services/fastapi-microservice.md` for architecture details and production recommendations.
- Deploy the API to Render via `render.yaml` (web + Celery worker + Celery beat).
