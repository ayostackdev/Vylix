from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.database import get_db
from app.deps import CurrentUser, get_current_user
from app.models import ConnectedAccount, ImportedFile, Topic, Course, Material, MaterialProcessingStatus
from app.services import google_drive
from app.services.storage import get_storage

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
    state = f"{user.id}:{uuid.uuid4()}"
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

        user_id = state.split(":")[0] if ":" in state else None
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
            )
            db.add(account)

        await db.flush()
        return RedirectResponse(url=f"{frontend_base}/onboarding?drive=connected")
    except Exception:
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
        email=account.scope,
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

@router.post("/import", response_model=list[ImportedFileOut])
async def import_files(
    payload: ImportRequest,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Import selected Google Drive files into a topic."""
    # Verify topic exists
    topic = await db.get(Topic, payload.topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    token = await _get_valid_token(user.id, db)
    storage = get_storage()
    imported = []

    for file_id in payload.file_ids[:20]:  # Max 20 files per import
        try:
            # Get file metadata
            file_meta = await google_drive.get_file_metadata(token, file_id)

            # Check if already imported
            existing = await db.execute(
                select(ImportedFile).where(
                    ImportedFile.drive_file_id == file_id,
                    ImportedFile.user_id == user.id,
                )
            )
            if existing.scalar_one_or_none():
                continue

            # Download file
            file_data = await google_drive.download_drive_file(token, file_id)

            # Store file
            material_id = str(uuid.uuid4())
            ext = file_meta.name.split(".")[-1] if "." in file_meta.name else "pdf"
            storage_path = f"materials/{material_id}.{ext}"

            url = await storage.upload(
                settings.supabase_storage_bucket,
                storage_path,
                file_data,
                file_meta.mime_type,
            )

            # Create material
            material = Material(
                id=material_id,
                file_name=file_meta.name,
                file_url=url,
                file_path=storage_path,
                file_size=len(file_data),
                topic_id=payload.topic_id,
                uploader_id=user.id,
                processing_status=MaterialProcessingStatus.QUEUED,
            )
            db.add(material)

            # Track import
            imported_file = ImportedFile(
                id=str(uuid.uuid4()),
                user_id=user.id,
                drive_file_id=file_id,
                file_name=file_meta.name,
                mime_type=file_meta.mime_type,
                file_size=len(file_data),
                material_id=material_id,
                status="imported",
                imported_at=datetime.now(timezone.utc),
            )
            db.add(imported_file)
            imported.append(imported_file)

        except Exception as e:
            # Track failed import
            failed = ImportedFile(
                id=str(uuid.uuid4()),
                user_id=user.id,
                drive_file_id=file_id,
                file_name=f"failed_{file_id}",
                mime_type="unknown",
                status="failed",
                error=str(e),
            )
            db.add(failed)

    await db.flush()
    return [
        ImportedFileOut(
            id=imp.id, drive_file_id=imp.drive_file_id,
            file_name=imp.file_name, status=imp.status,
            material_id=imp.material_id,
        )
        for imp in imported
    ]


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


# ── Auto-Import (scan Drive after connection) ────────────────────

class AutoImportResult(BaseModel):
    folders_scanned: int
    pdfs_found: int
    imported: int
    skipped: int
    topics_created: list[str]
    errors: list[str]


def _extract_course_code(folder_name: str) -> str | None:
    """Try to extract a course code like 'CSC301' from a folder name."""
    import re
    match = re.search(r'([A-Za-z]{2,4}\d{3})', folder_name)
    return match.group(1).upper() if match else None


@router.post("/auto-import", response_model=AutoImportResult)
async def auto_import_drive(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Scan Google Drive after connection, match folders to courses, import all PDFs."""
    token = await _get_valid_token(user.id, db)
    storage = get_storage()

    result = AutoImportResult(
        folders_scanned=0, pdfs_found=0, imported=0, skipped=0,
        topics_created=[], errors=[],
    )

    # Get or create a general course for unmatched folders
    general_course = await db.execute(
        select(Course).where(Course.is_general == True).limit(1)
    )
    general_course = general_course.scalar_one_or_none()
    if not general_course:
        general_course = Course(
            id=str(uuid.uuid4()),
            code="GEN",
            title="General Materials",
            level=100,
            is_general=True,
        )
        db.add(general_course)
        await db.flush()

    # Scan root folders
    folders = await google_drive.list_drive_folders(token, "root")
    result.folders_scanned = len(folders)

    # Also scan root-level PDFs (not in any folder)
    try:
        root_files, _ = await google_drive.list_drive_files(token, None, 100)
        for f in root_files:
            result.pdfs_found += 1
            # Check if already imported
            existing = await db.execute(
                select(ImportedFile).where(
                    ImportedFile.drive_file_id == f.id,
                    ImportedFile.user_id == user.id,
                )
            )
            if existing.scalar_one_or_none():
                result.skipped += 1
                continue

            # Import to general topic
            topic = await _get_or_create_topic(db, general_course.id, user.id, "Uncategorized")
            try:
                await _import_single_file(token, storage, db, f.id, topic.id, user.id)
                result.imported += 1
            except Exception as e:
                result.errors.append(f"{f.name}: {str(e)}")
    except Exception:
        pass

    # Scan each folder
    for folder in folders:
        try:
            files, _ = await google_drive.list_drive_files(token, folder.id, 100)
            result.pdfs_found += len(files)

            # Try to match folder to a course
            code = _extract_course_code(folder.name)
            course = None
            if code:
                course_result = await db.execute(
                    select(Course).where(Course.code.ilike(code))
                )
                course = course_result.scalar_one_or_none()

            target_course = course or general_course
            topic_name = folder.name if not course else folder.name
            topic = await _get_or_create_topic(db, target_course.id, user.id, topic_name)

            if not course:
                result.topics_created.append(folder.name)

            for f in files:
                # Check if already imported
                existing = await db.execute(
                    select(ImportedFile).where(
                        ImportedFile.drive_file_id == f.id,
                        ImportedFile.user_id == user.id,
                    )
                )
                if existing.scalar_one_or_none():
                    result.skipped += 1
                    continue

                try:
                    await _import_single_file(token, storage, db, f.id, topic.id, user.id)
                    result.imported += 1
                except Exception as e:
                    result.errors.append(f"{f.name}: {str(e)}")
        except Exception as e:
            result.errors.append(f"Folder '{folder.name}': {str(e)}")

    await db.flush()
    return result


async def _get_or_create_topic(db: AsyncSession, course_id: str, user_id: str, title: str) -> Topic:
    """Get an existing topic or create one."""
    result = await db.execute(
        select(Topic).where(
            Topic.course_id == course_id,
            Topic.is_active == True,
        ).limit(1)
    )
    topic = result.scalar_one_or_none()
    if topic:
        return topic

    topic = Topic(
        id=str(uuid.uuid4()),
        title=title,
        course_id=course_id,
        author_id=user_id,
    )
    db.add(topic)
    await db.flush()
    return topic


async def _import_single_file(
    token: str, storage, db: AsyncSession,
    drive_file_id: str, topic_id: str, user_id: str,
) -> None:
    """Import a single Drive file into the database."""
    file_meta = await google_drive.get_file_metadata(token, drive_file_id)
    file_data = await google_drive.download_drive_file(token, drive_file_id)

    material_id = str(uuid.uuid4())
    ext = file_meta.name.split(".")[-1] if "." in file_meta.name else "pdf"
    storage_path = f"materials/{material_id}.{ext}"

    url = await storage.upload(
        settings.supabase_storage_bucket, storage_path, file_data, file_meta.mime_type,
    )

    material = Material(
        id=material_id,
        file_name=file_meta.name,
        file_url=url,
        file_path=storage_path,
        file_size=len(file_data),
        topic_id=topic_id,
        uploader_id=user_id,
        processing_status=MaterialProcessingStatus.QUEUED,
    )
    db.add(material)

    imported_file = ImportedFile(
        id=str(uuid.uuid4()),
        user_id=user_id,
        drive_file_id=drive_file_id,
        file_name=file_meta.name,
        mime_type=file_meta.mime_type,
        file_size=len(file_data),
        material_id=material_id,
        status="imported",
        imported_at=datetime.now(timezone.utc),
    )
    db.add(imported_file)
