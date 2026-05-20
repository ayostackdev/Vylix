# DigitalOcean Deployment Guide

This repo is a monorepo with separate services, so the cleanest DigitalOcean setup is:

- `apps/web` as the Next.js frontend
- `apps/api` as the NestJS backend
- optional `apps/python-service` as the FastAPI support service
- one managed PostgreSQL database for the API

## Recommended DigitalOcean layout

Use App Platform for the app services and Managed Databases for Postgres.

### 1. Create the database

Create a Managed PostgreSQL database in DigitalOcean and copy the connection string.

Use that value as `DATABASE_URL` for the API service.

### 2. Deploy the API service

Service root: `apps/api`

Build command:

```bash
npm run prisma:generate && npm run build
```

Run command:

```bash
npm run start
```

Required environment variables:

- `DATABASE_URL`
- `PORT` if you want to pin a port, otherwise let App Platform supply it
- `PYTHON_SERVICE_URL` if you deploy the Python service separately
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`

The API already listens on `PORT` and falls back to `4000` in [apps/api/src/main.ts](apps/api/src/main.ts#L5-L21).

Prisma reads `DATABASE_URL` from [apps/api/prisma/schema.prisma](apps/api/prisma/schema.prisma#L5-L8).

### 3. Deploy the web service

Service root: `apps/web`

Build command:

```bash
npm run build
```

Run command:

```bash
npm run start
```

Required environment variables:

- `NEXT_PUBLIC_API_BASE_URL` pointing to the public API URL
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

The frontend reads those Supabase variables in [apps/web/lib/supabase-client.ts](apps/web/lib/supabase-client.ts#L7-L20).

The API base URL should match the value in [apps/web/.env.example](apps/web/.env.example#L1-L5).

### 4. Optional Python service

Service root: `apps/python-service`

Build command:

```bash
python -m pip install -r requirements.txt
```

Run command:

```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Required environment variables:

- `POSTGRES_DSN`
- `CORS_ORIGINS`
- `CELERY_BROKER_URL`
- `CELERY_RESULT_BACKEND`
- `APP_NAME`
- `ENVIRONMENT`

These settings are defined in [apps/python-service/app/core/config.py](apps/python-service/app/core/config.py#L8-L30).

### 5. Run migrations

After the API service is deployed and can reach the managed database, run:

```bash
cd apps/api
npx prisma migrate deploy
```

## Suggested deployment order

1. Create the PostgreSQL database.
2. Deploy the API and confirm it starts.
3. Run Prisma migrations.
4. Deploy the web app.
5. Deploy the Python service only if you need the upload/OCR/AI workflows.

## Notes

- If you only want a first production release, deploy web + API first and leave the Python service off until you need it.
- If you use the Python service, update `PYTHON_SERVICE_URL` in the API service to its public URL.
- If App Platform gives you a generated port, keep the service listening on that port rather than hardcoding one in production.