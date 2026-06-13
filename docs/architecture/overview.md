# Platform Overview

Vylix is a monorepo with three main application surfaces:

- `apps/web`: Next.js client with offline-first storage and settings/profile flows.
- `apps/api`: NestJS backend with Prisma, guards, telemetry, and feature modules.
- `apps/python-service`: FastAPI support service for document processing, OCR, analytics, and background jobs.

## Core layers

- Frontend: dashboard, profile, settings, vault, and public pulse UI.
- Backend: auth, materials, topics, courses, maintenance, telemetry, and user settings.
- Database: PostgreSQL via Prisma models for users, emails, privacy, badges, colleges, departments, courses, topics, and materials.
- External services: Supabase Auth, Supabase Storage, websocket events, and the Python microservice.

## Current focus

- Student document upload and retrieval.
- Identity continuity with linked emails.
- Privacy and profile controls.
- Supporting OCR and document intelligence through the Python service.