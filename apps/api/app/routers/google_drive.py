from __future__ import annotations

import logging
from datetime import datetime, timezone
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.database import get_db
from app.deps import CurrentUser, get_current_user
from app.models import ConnectedAccount, ImportedFile, Topic
from app.services import google_drive
from app.tasks_drive import import_drive_files, auto_import_drive

logger = logging.getLogger(__name__)

settings = get_settings()
router = APIRouter(prefix="/google-drive", tags=["google-drive"])


# ── Schemas ────────────────────────────────────────────────────────

class ConnectResponse(BaseModel):
    auth_url: str


class FolderOut(BaseModel):
    id: str
    name: str


class FileOut(BaseModel):
    id: str
    name: str
    mime_type: str
    size: int
    created_time: str


class ImportRequest(BaseModel):
    file_ids: list[str]
    topic_id: str


class ImportedFileOut(BaseModel):
    id: str
    drive_file_id: str
    file_name: str
    status: str
    material_id: str | None = None

    model_config = {"from_attributes": True}


class ConnectionStatus(BaseModel):
    connected: bool
    email: str | None = None
    connected_at: str | None = None


# ── Connect Flow ───────────────────────────────────────────────────

@router.get("/connect", response_model=ConnectResponse)
async def connect_google_drive(
    user: CurrentUser = Depends(get_current_user),
):
    """Start Google OAuth flow. Returns URL to redirect user to."""
    state = google_drive.sign_state(user.id)
    auth_url = google_drive.get_auth_url(state)
    return ConnectResponse(auth_url=auth_url)


@router.get("/callback")
async def google_callback(
    code: str = Query(...),
    state: str = Query(default=""),
    db: AsyncSession = Depends(get_db),
):
    """Handle Google OAuth callback. Exchanges code for tokens, redirects to frontend."""
    frontend_base = settings.frontend_url.rstrip("/")

    if not code:
        return RedirectResponse(url=f"{frontend_base}/onboarding?drive=error&detail=no_code")

    try:
        tokens = await google_drive.exchange_code(code)
        user_info = await google_drive.get_user_info(tokens.access_token)
        google_email = user_info.get("email")
        google_id = user_info.get("id")

        user_id = google_drive.verify_state(state)
        if not user_id:
            return RedirectResponse(url=f"{frontend_base}/onboarding?drive=error&detail=invalid_state")

        existing = await db.execute(
            select(ConnectedAccount).where(
                ConnectedAccount.user_id == user_id,
                ConnectedAccount.provider == "google",
            )
        )
        account = existing.scalar_one_or_none()

        if account:
            account.access_token = tokens.access_token
            if tokens.refresh_token:
                account.refresh_token = tokens.refresh_token
            account.token_expires_at = datetime.fromtimestamp(tokens.expires_at, tz=timezone.utc) if tokens.expires_at else None
            account.scope = tokens.scope
            account.email = google_email
        else:
            account = ConnectedAccount(
                id=str(uuid.uuid4()),
                user_id=user_id,
                provider="google",
                provider_user_id=google_id,
                access_token=tokens.access_token,
                refresh_token=tokens.refresh_token,
                token_expires_at=datetime.fromtimestamp(tokens.expires_at, tz=timezone.utc) if tokens.expires_at else None,
                scope=tokens.scope,
                email=google_email,
            )
            db.add(account)

        await db.flush()
        return RedirectResponse(url=f"{frontend_base}/onboarding?drive=connected")
    except Exception:
        logger.exception("Google OAuth callback failed for state=%s", state)
        return RedirectResponse(url=f"{frontend_base}/onboarding?drive=error&detail=callback_failed")


# ── Connection Status ──────────────────────────────────────────────

@router.get("/status", response_model=ConnectionStatus)
async def connection_status(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check if user has connected Google Drive."""
    result = await db.execute(
        select(ConnectedAccount).where(
            ConnectedAccount.user_id == user.id,
            ConnectedAccount.provider == "google",
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        return ConnectionStatus(connected=False)
    return ConnectionStatus(
        connected=True,
        email=account.email or account.provider_user_id,
        connected_at=str(account.created_at) if account.created_at else None,
    )


@router.delete("/disconnect")
async def disconnect(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Disconnect Google Drive."""
    result = await db.execute(
        select(ConnectedAccount).where(
            ConnectedAccount.user_id == user.id,
            ConnectedAccount.provider == "google",
        )
    )
    account = result.scalar_one_or_none()
    if account:
        await db.delete(account)
        await db.flush()
    return {"message": "Disconnected"}


# ── Browse Drive ───────────────────────────────────────────────────

async def _get_valid_token(user_id: str, db: AsyncSession) -> str:
    """Get a valid access token, refreshing if needed."""
    result = await db.execute(
        select(ConnectedAccount).where(
            ConnectedAccount.user_id == user_id,
            ConnectedAccount.provider == "google",
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Google Drive not connected")

    # Check if token is expired
    if account.token_expires_at and account.token_expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        if not account.refresh_token:
            raise HTTPException(status_code=401, detail="Token expired, please reconnect")
        new_tokens = await google_drive.refresh_access_token(account.refresh_token)
        account.access_token = new_tokens.access_token
        account.token_expires_at = datetime.fromtimestamp(new_tokens.expires_at, tz=timezone.utc) if new_tokens.expires_at else None
        await db.flush()

    return account.access_token


@router.get("/folders", response_model=list[FolderOut])
async def list_folders(
    folder_id: str = Query(default="root"),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List folders in Google Drive."""
    token = await _get_valid_token(user.id, db)
    folders = await google_drive.list_drive_folders(token, folder_id)
    return [FolderOut(id=f.id, name=f.name) for f in folders]


@router.get("/files", response_model=list[FileOut])
async def list_files(
    folder_id: str = Query(default=None),
    page_size: int = Query(default=50, ge=1, le=100),
    page_token: str | None = Query(default=None),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List PDF files in Google Drive folder."""
    token = await _get_valid_token(user.id, db)
    files, _ = await google_drive.list_drive_files(token, folder_id, page_size, page_token)
    return [
        FileOut(id=f.id, name=f.name, mime_type=f.mime_type, size=f.size, created_time=f.created_time)
        for f in files
    ]


# ── Import Files ───────────────────────────────────────────────────

@router.post("/import")
async def import_files(
    payload: ImportRequest,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Import selected Google Drive files into a topic. Runs in background."""
    topic = await db.get(Topic, payload.topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    token = await _get_valid_token(user.id, db)

    task = import_drive_files.delay(user.id, payload.file_ids[:20], payload.topic_id)
    return {"task_id": task.id, "status": "queued", "file_count": len(payload.file_ids[:20])}


@router.get("/imports", response_model=list[ImportedFileOut])
async def list_imports(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all imported files."""
    result = await db.execute(
        select(ImportedFile)
        .where(ImportedFile.user_id == user.id)
        .order_by(ImportedFile.created_at.desc())
    )
    return [
        ImportedFileOut(
            id=imp.id, drive_file_id=imp.drive_file_id,
            file_name=imp.file_name, status=imp.status,
            material_id=imp.material_id,
        )
        for imp in result.scalars().all()
    ]


@router.post("/auto-import")
async def auto_import_drive_endpoint(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Scan Google Drive and import all PDFs. Runs in background."""
    token = await _get_valid_token(user.id, db)
    task = auto_import_drive.delay(user.id)
    return {"task_id": task.id, "status": "queued"}
