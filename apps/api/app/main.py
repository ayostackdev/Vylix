from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routers import (
    health, colleges, courses, topics, user, materials,
    qna, gamification, settings, collaboration, maintenance,
    documents, analytics, insights, uploads, ws, google_drive,
)

settings = get_settings()

app = FastAPI(title=settings.app_name, version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Core routers
app.include_router(health.router)
app.include_router(colleges.router, prefix=settings.api_prefix)
app.include_router(courses.router, prefix=settings.api_prefix)
app.include_router(topics.router, prefix=settings.api_prefix)
app.include_router(user.router, prefix=settings.api_prefix)
app.include_router(materials.router, prefix=settings.api_prefix)
app.include_router(qna.router, prefix=settings.api_prefix)
app.include_router(gamification.router, prefix=settings.api_prefix)
app.include_router(settings.router, prefix=settings.api_prefix)
app.include_router(collaboration.router, prefix=settings.api_prefix)
app.include_router(maintenance.router, prefix=settings.api_prefix)
app.include_router(google_drive.router, prefix=settings.api_prefix)

# AI/ML routers (from python-service)
app.include_router(documents.router, prefix=settings.api_prefix)
app.include_router(analytics.router, prefix=settings.api_prefix)
app.include_router(insights.router, prefix=settings.api_prefix)
app.include_router(uploads.router, prefix=settings.api_prefix)

# WebSocket
app.include_router(ws.router)
