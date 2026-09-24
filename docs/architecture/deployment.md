# Deploying Vylix — Web (Vercel) + API (Render)

Vylix ships as two surfaces:

- `apps/web` — Next.js PWA, deployed on **Vercel**
- `apps/api` — FastAPI backend, deployed on **Render** (via `render.yaml` blueprint)

## 1. Web → Vercel

1. Push to GitHub (`main`).
2. Vercel will auto-deploy from the repo (project already linked in `.vercel/project.json`).
3. Set env vars in Vercel → Project → Settings → Environment Variables:
   - `NEXT_PUBLIC_API_BASE_URL=https://vylix-api.onrender.com` (the Render API URL — see below)
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Note: the web app falls back to `localhost:4000` when `NEXT_PUBLIC_API_BASE_URL` is
unset. Always set it in production.

## 2. API → Render

`render.yaml` at the repo root is a Render Blueprint. It deploys the **lean API**
web service (`Dockerfile` target `api-lean` — R2 uploads, embeddings, and search;
no torch/docling for the API process itself).

1. Go to https://render.com → New → **Blueprint** → connect the GitHub repo.
2. Render detects `render.yaml` and creates the `vylix-api` web service.
3. Open the service → **Settings → Environment** and add the required secrets
   (Render does not read your local `.env`). Values come from `apps/api/.env`:

   Required:
   - `DATABASE_URL`, `DIRECT_URL` (Supabase pooler connection strings)
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`
   - `GEMINI_API_KEY`
   - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
   - `R2_STORAGE_PUBLIC_BASE_URL`, `R2_AVATARS_PUBLIC_BASE_URL`
   - `FRONTEND_URL=https://vylix-web.vercel.app`
   - `CORS_ORIGINS=https://vylix-web.vercel.app`

   Non-secret values baked into the blueprint (STORAGE_PROVIDER=r2, bucket
   names) can stay as-is.

4. **Deploy**. Health check: `GET https://vylix-api.onrender.com/health`
   (mounted without the `/api/v1` prefix). Expected `"status": "ok"`.

## 3. Background workers (Celery — optional for uploads)

Docling/OCR PDF parsing runs on a Celery worker, which needs a Redis broker.

- Render free tier does **not** bundle managed Redis.
- R2 **uploads work without Redis** — the enqueue is broker-guarded, so a
  missing broker only leaves materials `QUEUED` (no parsing).
- When ready for parsing, either add the Render Redis add-on, or use a free
  Upstash/ValKey instance, then uncomment the `vylix-worker` block in
  `render.yaml` and set `BROKER_URL`/`RESULT_BACKEND`.

## 4. Verify end-to-end

1. Browser → `https://vylix-web.vercel.app` — dashboard loads.
2. Sign in, upload a PDF → the call hits `POST {API}/api/v1/materials/upload`
   (or the presigned direct-upload path) → object lands in R2 `vylix-materials`.
3. Confirm the returned `file_url` starts with
   `https://pub-379bd55eb5014322935b7ae001b688c3.r2.dev/`.
4. Open the URL in a browser → downloads the file (public bucket access).