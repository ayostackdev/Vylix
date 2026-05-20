# CamPulse Python Support Service

FastAPI support service for document intelligence, OCR, semantic retrieval, analytics, and PDF compression.

## What it provides

- `GET /health` for service status.
- `POST /api/v1/documents/compress` for backend PDF compression with PyMuPDF.
- `POST /api/v1/documents/parse` for PDF text extraction and chunking.
- `POST /api/v1/documents/ingest` for Docling parsing plus Chroma-backed indexing.
- `GET /api/v1/documents/search` for semantic retrieval over indexed chunks.
- `POST /api/v1/documents/ocr` for OCR extraction from uploaded images.
- `POST /api/v1/uploads` for content-hash file uploads with PostgreSQL deduplication.
- `POST /api/v1/analytics/gpa-prediction` for the starter GPA prediction surface.

## Local setup

1. Create a virtual environment.
2. Install dependencies from `requirements.txt`.
3. Copy `.env.example` to `.env`.
4. Run the app with `uvicorn app.main:app --reload`.

## Notes

- Celery is wired for background tasks and expects a broker such as Redis.
- Docling, LangChain or LlamaIndex, ChromaDB or FAISS, and OCR libraries can be added per deployment needs.
- The service is a companion to the Nest.js backend, not the primary API surface.
- The service is scaffolded to make the PDF compression step happen before upload to Supabase.
- The upload endpoint uses a unique `content_hash` column in PostgreSQL to reject duplicate content with HTTP 409.
