# Railway Deployment

This is the backend deployment fallback guide for Railway.

## Steps

1. Deploy `apps/api` from GitHub.
2. Add a PostgreSQL database.
3. Set `DATABASE_URL` and `NODE_ENV=production`.
4. Set `PORT` if needed.
5. Run Prisma migrations.

## Notes

- Use this only if you are deploying the backend outside DigitalOcean.