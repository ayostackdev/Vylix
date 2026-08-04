# Platform Overview

Vylix is a monorepo with two main application surfaces:

- `apps/web`: Next.js client (PWA) with offline-first storage, settings/profile flows, dashboard, and academic hub.
- `apps/api`: FastAPI backend with Supabase JWT auth, materials/past-questions, courses/topics, gamification, and AI-assisted study features.

## Core layers

- Frontend: dashboard, profile, settings, vault, past-questions, and academic hub UI.
- Backend: auth, materials, topics, courses, departments/colleges, maintenance, analytics, and user settings.
- Database: PostgreSQL (SQLAlchemy models) for users, emails, privacy, badges, colleges, departments, courses, topics, and materials.
- External services: Supabase Auth, Supabase Storage, Redis (Celery broker/result backend), and Gemini for document/AI features.

## Current focus

- Student document upload and retrieval.
- Shared past-questions feed with course/year/semester filtering.
- Identity continuity with linked emails.
- Privacy and profile controls.

## Deployments

- Web: Vercel (`apps/web`)
- API: Render (`render.yaml` at repo root: web service + Celery worker + Celery beat)
