# CamPulse Python service (FastAPI)

Lightweight support service for document processing and AI-assisted insights.

Local setup
1. Create a Python virtualenv and install deps: `pip install -r requirements.txt`
2. Copy `.env.example` -> `.env` and set local values (Postgres, Redis, etc.)
3. Run: `uvicorn app.main:app --reload`

Notes
- Celery is used for background tasks (requires Redis broker).
- See `docs/fastapi-microservice.md` for architecture details and production recommendations.
