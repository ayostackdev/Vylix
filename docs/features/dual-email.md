# Dual Email Architecture

This project supports linked school and personal emails so students can keep access continuity.

## What it covers

- Supabase OAuth/session support in the frontend
- identity linking flows in the web app
- email linking endpoints in the backend
- multi-email validation in the auth guard

## User outcome

- a student can sign in
- link a backup email
- keep account access after institutional email loss

## Quick reference

- `POST /auth/link-email`
- `GET /auth/emails/:userId`
- `PUT /auth/primary-email/:userId`
- `POST /auth/verify-email/:userId`
- `DELETE /auth/emails/:userId/:email`