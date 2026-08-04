# FastAPI Backend Notes

The Vylix API (`apps/api`) is a FastAPI service covering auth (Supabase JWT),
materials and past-questions, courses/topics, gamification, and AI-assisted study
features, including document intelligence, RAG, OCR, and analytics.

## Service responsibilities

- Accept document upload and ingestion jobs.
- Parse PDFs into structured text and Markdown-ready content.
- Extract text from scanned or image-based pages.
- Build and query semantic indexes for student-facing retrieval.
- Run long jobs asynchronously so the API remains responsive.
- Compress PDFs before storage upload to keep Supabase usage efficient.

## Exposed endpoints

- `POST /api/v1/documents/compress`
- `POST /api/v1/documents/parse`
- `POST /api/v1/documents/ingest`
- `GET /api/v1/documents/search`
- `POST /api/v1/documents/ocr`
- `POST /api/v1/analytics/gpa-prediction`

## Approved library stack

### API and background jobs

- FastAPI and Uvicorn for the HTTP API and ASGI server.
- Celery for background queue processing of heavy document tasks.

### AI, RAG, and document intelligence

- Docling for PDF parsing, layout understanding, tables, formulas, and structured output.
- LangChain or LlamaIndex for RAG orchestration.
- ChromaDB or FAISS for vector search and retrieval.

### OCR

- pytesseract or EasyOCR for handwritten notes and scanned paper extraction.

### Data science and analytics

- scikit-learn, pandas, and NumPy for feature engineering, cleaning, and GPA prediction workflows.

### PDF compression

- PyMuPDF for backend-side PDF compression before upload to Supabase.
- Compression is treated as a standard ingestion step so uploads stay smaller and downstream downloads remain fast.

## Processing flow

1. Upload or receive a document job.
2. Compress the PDF with PyMuPDF.
3. Parse the document with Docling.
4. Send scanned pages through OCR when needed.
5. Chunk and embed the parsed content.
6. Store vectors in ChromaDB or FAISS.
7. Run retrieval and analytics jobs asynchronously through Celery.

## Notes

- The FastAPI backend lives in apps/api.
- The AI/document workflows run inside apps/api via Celery workers.
- This file captures the approved stack and document workflow for the API's document features.