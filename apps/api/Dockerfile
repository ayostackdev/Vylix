FROM python:3.11-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM deps AS api-run
COPY app/ app/
COPY db/ db/
EXPOSE 4000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "4000"]

FROM base AS worker
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ app/
CMD ["celery", "-A", "app.tasks.celery_app", "worker", "--loglevel=info", "--concurrency=5"]

# Lean production target (no torch, easyocr, docling, transformers)
# This is the DEFAULT target — Docker builds this when no target is specified
FROM base AS lean-deps
COPY requirements-lean.txt .
RUN pip install --no-cache-dir -r requirements-lean.txt

FROM lean-deps AS api-lean
COPY app/ app/
COPY db/ db/
COPY alembic.ini .
COPY migrations/ migrations/
EXPOSE 4000
CMD alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 4000
