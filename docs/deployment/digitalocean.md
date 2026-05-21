# DigitalOcean Deployment

Backend-only App Platform setup:

1. Create a Managed PostgreSQL database.
2. Set the API service root to `apps/api`.
3. Build with `npm run prisma:generate && npm run build`.
4. Run with `npm run start`.
5. Set `DATABASE_URL`, `PORT`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_STORAGE_BUCKET`.
6. Deploy and then run Prisma migrations.

## Notes

- The backend already listens on `PORT` and falls back to 4000.
- Prisma reads `DATABASE_URL` from the environment.