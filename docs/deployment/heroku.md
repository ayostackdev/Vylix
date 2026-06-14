# Heroku Deployment

This is the active backend deployment path.

## Node API app

1. Create a new Heroku app from the repository root.
2. Set `DATABASE_URL`, `DIRECT_URL`, `REDIS_URL`, `PYTHON_SERVICE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`, and `MAINTENANCE_API_KEY`.
3. Add a Postgres add-on and connect it to the same database referenced by Prisma.
4. Add a Redis add-on for BullMQ and rate limiting.
5. Deploy the app and let the `release` phase run Prisma migrations.
6. Scale the `worker` dyno if you need background jobs.

## Python service app

1. Create a second Heroku app for `apps/python-service` if you still need the AI microservice.
2. Set `POSTGRES_DSN`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`, `CORS_ORIGINS`, and `MAX_UPLOAD_MB`.
3. Add the same Redis and Postgres resources or separate ones if you want to isolate workloads.
4. Deploy using the Python buildpack, the local `Procfile` in that directory, and the pinned runtime in `runtime.txt`.
5. Scale the `worker` dyno if you need background Celery jobs.

## Notes

- The API listens on `PORT` and exposes `/health` for Heroku health checks.
- Prisma migrations run in the `release` phase via `npm run prisma:deploy`.
- The Python service has both `web` and `worker` process types so Celery can run on Heroku.
