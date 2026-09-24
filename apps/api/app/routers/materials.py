from __future__ import annotations

import logging
import socket
import uuid
from datetime import datetime, timezone
from urllib.parse import urlparse

import anyio
from fastapi import APIRouter, Depends, Form, HTTPException, Query, UploadFile, File
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.database import get_db
from app.deps import CurrentUser, get_current_user, get_optional_user
from app.entitlements import storage_allowance, storage_used
from app.models import (
    Material, Topic, Course, User, Department, College, University,
    MaterialProcessingStatus, MaterialUnlock, PointsTransaction,
)
from app.services.course_scope import course_visibility_filter, find_course
from app.services import points as points_service
from app.services.storage import get_storage
from app.services.upload_stream import (
    read_spool, replace_spooled_contents, stream_async_upload_to_spool,
)
from app.services.vector_store import VectorStore
from app.tasks import process_material_task

logger = logging.getLogger(__name__)
settings = get_settings()
router = APIRouter(prefix="/materials", tags=["materials"])
_vector_store = VectorStore()

MAX_COMPRESS_BYTES = 4 * 1024 * 1024
COMPRESS_TIMEOUT_SECONDS = 20


def _celery_broker_reachable(timeout: float = 1.5) -> bool:
    """Fast reachability check for the Celery broker.

    apply_async blocks for minutes retrying the Redis result backend when the
    broker is down, so uploads would hang even though the comment below intends
    them to stay fast. Skip enqueueing (leaving the material QUEUED) instead.
    """
    try:
        parsed = urlparse(settings.celery_broker_url)
        host = parsed.hostname or "localhost"
        port = parsed.port or 6379
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def _compress_pdf_bytes(data: bytes, filename: str) -> bytes:
    """Best-effort in-memory PDF compression via Ghostscript.

    Compression is strictly optional: it must never block or fail an upload.
    Large PDFs are skipped so a heavy Ghostscript run cannot stall the request
    or crash the (free-tier, low-memory) instance.
    """
    from app.services.pdf_compressor import compress_pdf_bytes

    return compress_pdf_bytes(
        data,
        filename,
        max_bytes=MAX_COMPRESS_BYTES,
        timeout=COMPRESS_TIMEOUT_SECONDS,
    )


class TopicRef(BaseModel):
    id: str
    title: str

    model_config = {"from_attributes": True}


class MaterialOut(BaseModel):
    id: str
    file_name: str
    file_url: str
    file_size: int
    topic_id: str
    topic: TopicRef | None = None
    uploader_id: str
    uploader_name: str | None = None
    uploader_avatar: str | None = None
    processing_status: str
    summary: str | None = None
    questions: dict | None = None
    tips: dict | None = None
    uploaded_at: str | None = None
    last_opened_at: str | None = None
    is_seed: bool = False
    is_shared: bool = True
    is_past_question: bool = False
    exam_year: int | None = None
    semester: str | None = None
    already_existed: bool = False
    points_awarded: int = 0
    is_pool_item: bool = False
    origin_institution: str | None = None
    source_university_id: str | None = None

    model_config = {"from_attributes": True}


class PastQuestionOut(MaterialOut):
    course_code: str | None = None
    course_title: str | None = None


class MaterialListOut(BaseModel):
    items: list[MaterialOut]
    total: int


class MaterialDetailOut(MaterialOut):
    course_id: str | None = None
    course_code: str | None = None
    course_title: str | None = None


class RequestUploadRequest(BaseModel):
    file_name: str
    file_size: int
    content_type: str
    title: str | None = None
    course_code: str | None = None
    department_code: str | None = None
    is_past_question: bool = False
    exam_year: int | None = None
    semester: str | None = None
    content_hash: str | None = None


class RequestUploadOut(BaseModel):
    material_id: str
    storage_path: str
    upload_url: str
    expires_in: int


class CompleteUploadRequest(BaseModel):
    material_id: str
    storage_path: str
    file_name: str
    file_size: int
    title: str | None = None
    course_code: str | None = None
    department_code: str | None = None
    is_past_question: bool = False
    exam_year: int | None = None
    semester: str | None = None
    content_hash: str | None = None


class PastQuestionListOut(BaseModel):
    items: list[PastQuestionOut]
    total: int


async def _award_pq_points(db: AsyncSession, user_id: str, material: Material) -> int:
    """Credit study points for a distinct past-question upload (and milestone)."""
    points_awarded = await points_service.award(
        db, user_id, points_service.PQ_UPLOAD_POINTS,
        points_service.REASON_PQ_UPLOAD,
        description="Uploaded a new past question",
        related_id=material.id,
    )
    distinct_count = (
        await db.execute(
            select(func.count(func.distinct(Material.content_hash))).where(
                Material.uploader_id == user_id,
                Material.is_past_question == True,  # noqa: E712
                Material.content_hash.isnot(None),
            )
        )
    ).scalar_one()
    if (
        points_service.PQ_MILESTONE_EVERY
        and distinct_count % points_service.PQ_MILESTONE_EVERY == 0
    ):
        points_awarded += await points_service.award(
            db, user_id, points_service.PQ_MILESTONE_POINTS,
            points_service.REASON_PQ_MILESTONE,
            description=f"{distinct_count} past questions uploaded",
        )
    return points_awarded


def _material_to_out(
    m: Material,
    is_pool_item: bool = False,
    origin_institution: str | None = None,
    source_university_id: str | None = None,
) -> MaterialOut:
    uploader = getattr(m, "uploader", None)
    topic = getattr(m, "topic", None)
    return MaterialOut(
        id=m.id, file_name=m.file_name, file_url=m.file_url,
        file_size=m.file_size, topic_id=m.topic_id,
        topic=TopicRef.model_validate(topic) if topic else None,
        uploader_id=m.uploader_id,
        uploader_name=uploader.full_name if uploader else None,
        uploader_avatar=uploader.avatar_url if uploader else None,
        processing_status=m.processing_status.value,
        summary=m.summary, questions=m.questions, tips=m.tips,
        uploaded_at=str(m.uploaded_at) if m.uploaded_at else None,
        last_opened_at=str(m.last_opened_at) if m.last_opened_at else None,
        is_seed=m.is_seed, is_shared=m.is_shared,
        is_past_question=m.is_past_question,
        exam_year=m.exam_year, semester=m.semester,
        is_pool_item=is_pool_item,
        origin_institution=origin_institution,
        source_university_id=source_university_id,
    )


# ── National content pool ──────────────────────────────────────────
# When local (own-department / own-institution) course content is thin,
# same-``code`` materials uploaded at other institutions are surfaced so a
# brand-new signup never meets an empty vault. Matches are cross-institution
# only; ``is_shared`` and a clean processing state gate everything.

_POOL_FALLBACK_THRESHOLD = 3
_POOL_FALLBACK_LIMIT = 10
_POOL_PER_ORIGIN = 3
_RECENT_FALLBACK_THRESHOLD = 6
_RECENT_FALLBACK_LIMIT = 6
_RECENT_FALLBACK_CODES = 6


def _course_institution_expr():
    return func.coalesce(Course.university_id, College.university_id)


def _pool_statuses() -> list:
    return [MaterialProcessingStatus.COMPLETED, MaterialProcessingStatus.QUEUED]


def _pool_base(
    codes: list[str],
    exclude_university_id: str | None,
    is_past_question: bool | None = None,
    exam_year: int | None = None,
):
    """Select (Material, source university id, source university name) rows.

    Department-scoped courses carry their institution implicitly (via
    college), general courses carry it explicitly — coalesce unifies both.
    """
    expr = _course_institution_expr()
    stmt = (
        select(Material, University.id, University.name)
        .join(Topic, Topic.id == Material.topic_id)
        .join(Course, Course.id == Topic.course_id)
        .outerjoin(Department, Department.id == Course.department_id)
        .outerjoin(College, College.id == Department.college_id)
        .outerjoin(University, expr == University.id)
        .where(
            Course.code.in_(codes),
            Topic.is_active == True,  # noqa: E712
            Material.is_shared == True,  # noqa: E712
            Material.processing_status.in_(_pool_statuses()),
        )
    )
    if exclude_university_id:
        stmt = stmt.where((expr != exclude_university_id) | (expr.is_(None)))
    if is_past_question is not None:
        stmt = stmt.where(Material.is_past_question == is_past_question)
    if exam_year is not None:
        stmt = stmt.where(Material.exam_year == exam_year)
    return stmt


async def _fetch_pool(
    db: AsyncSession,
    codes: list[str],
    exclude_university_id: str | None,
    *,
    is_past_question: bool | None = None,
    exam_year: int | None = None,
    offset: int = 0,
    limit: int | None = None,
) -> tuple[int, list]:
    base = _pool_base(codes, exclude_university_id, is_past_question, exam_year)
    total = (
        await db.execute(
            select(func.count()).select_from(
                base.with_only_columns(Material.id).order_by(None)
            )
        )
    ).scalar_one()
    stmt = (
        base
        .order_by(func.coalesce(Material.last_opened_at, Material.uploaded_at).desc())
        .options(selectinload(Material.uploader))
        .offset(offset)
    )
    if limit is not None:
        stmt = stmt.limit(limit)
    rows = (await db.execute(stmt)).all()
    return total, rows


def _pool_row_to_out(row) -> MaterialOut:
    m, uni_id, uni_name = row
    return _material_to_out(
        m,
        is_pool_item=True,
        origin_institution=uni_name,
        source_university_id=uni_id,
    )


def _merge_pool_rows(
    rows: list,
    seen_ids: set,
    seen_hashes: set,
) -> list[MaterialOut]:
    """Append pool rows, deduping against what the user already has.

    One file (same ``content_hash``) is shown once, and each source
    institution is capped at ``_POOL_PER_ORIGIN`` rows for variety.
    """
    merged, per_origin = [], {}
    for row in rows:
        m, uni_id, _ = row
        if m.id in seen_ids or (m.content_hash and m.content_hash in seen_hashes):
            continue
        if uni_id:
            count = per_origin.get(uni_id, 0)
            if count >= _POOL_PER_ORIGIN:
                continue
            per_origin[uni_id] = count + 1
        merged.append(_pool_row_to_out(row))
        seen_ids.add(m.id)
        if m.content_hash:
            seen_hashes.add(m.content_hash)
    return merged


async def _resolve_topic(
    db: AsyncSession,
    course_code: str | None,
    department_code: str | None,
    user_id: str,
    university_id: str | None = None,
) -> str:
    if not course_code:
        general_visibility = [
            Course.is_general == True,  # noqa: E712
            Topic.is_active == True,  # noqa: E712
        ]
        visibility = course_visibility_filter(university_id)
        if visibility is not None:
            general_visibility.append(visibility)
        dept_topic = await db.execute(
            select(Topic)
            .join(Course, Course.id == Topic.course_id)
            .join(Department, Department.id == Course.department_id, isouter=True)
            .join(College, College.id == Department.college_id, isouter=True)
            .where(*general_visibility)
            .order_by(Topic.last_activity.desc())
            .limit(1)
        )
        topic = dept_topic.scalar_one_or_none()
        if topic:
            return topic.id
        course_result = await db.execute(
            select(Course)
            .join(Department, Department.id == Course.department_id, isouter=True)
            .join(College, College.id == Department.college_id, isouter=True)
            .where(
                Course.is_general == True,  # noqa: E712
                *(
                    [visibility]
                    if visibility is not None
                    else []
                ),
            )
            .limit(1)
        )
        course = course_result.scalar_one_or_none()
        if not course:
            raise HTTPException(status_code=400, detail="No course found. Provide a course code.")
        topic = Topic(
            id=str(uuid.uuid4()), title="General Materials",
            course_id=course.id, author_id=user_id, is_active=True,
        )
        db.add(topic)
        await db.flush()
        return topic.id

    resolved = await find_course(db, course_code, university_id)
    if resolved is None:
        raise HTTPException(
            status_code=404,
            detail=f"Course '{course_code}' not found. Check the code or upload without one."
        )
    course = resolved[0]

    result = await db.execute(
        select(Topic).where(Topic.course_id == course.id, Topic.is_active == True)
        .order_by(Topic.last_activity.desc()).limit(1)
    )
    topic = result.scalar_one_or_none()
    if topic:
        return topic.id

    topic = Topic(
        id=str(uuid.uuid4()), title=course.title,
        course_id=course.id, author_id=user_id, is_active=True,
    )
    db.add(topic)
    await db.flush()
    return topic.id


@router.post("/upload", response_model=MaterialOut)
async def upload_material(
    file: UploadFile = File(...),
    title: str | None = Form(None),
    course_code: str | None = Form(None),
    department_code: str | None = Form(None),
    is_past_question: str | None = Form(None),
    exam_year: str | None = Form(None),
    semester: str | None = Form(None),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.user.status.value == "ALUMNI":
        raise HTTPException(status_code=403, detail="Alumni cannot upload materials")

    allowed = {"application/pdf", "image/jpeg", "image/jpg", "image/png"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Only PDF, JPEG, PNG allowed")

    max_bytes = settings.max_upload_mb * 1024 * 1024
    # Stream the body into a spooled temp file (disk-backed once >1MB) with
    # the size check applied per chunk and the dedup hash computed in-flight,
    # instead of buffering the whole upload in RAM.
    try:
        spool, file_size, content_hash = await stream_async_upload_to_spool(file, max_bytes)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"File exceeds {settings.max_upload_mb}MB limit")

    # Compression is best-effort (compress_pdf_bytes never raises) and only
    # for PDFs small enough to justify holding the bytes once.
    if file.content_type == "application/pdf" and file_size <= MAX_COMPRESS_BYTES:
        compressed = await anyio.to_thread.run_sync(
            lambda: _compress_pdf_bytes(read_spool(spool), file.filename or "document.pdf")
        )
        replace_spooled_contents(spool, compressed)
        file_size = len(compressed)

    allowance = await storage_allowance(db, user.id)
    used = await storage_used(db, user.id)
    if used + file_size > allowance:
        spool.close()
        raise HTTPException(
            status_code=400,
            detail=(
                "STORAGE_LIMIT_REACHED "
                f"(used {used // (1024 * 1024)}MB of {allowance // (1024 * 1024)}MB). "
                "Upgrade your plan to unlock more vault storage."
            ),
        )

    topic_id = await _resolve_topic(
        db, course_code, department_code, user.id, user.user.university_id
    )

    material_id = str(uuid.uuid4())
    ext = file.filename.split(".")[-1] if file.filename else "pdf"

    # Content-address dedup: files whose compressed bytes already exist in the
    # vault reuse the stored blob instead of uploading a duplicate. The new
    # material still owns its own entry and its own quota share.
    existing = (
        await db.execute(
            select(Material)
            .where(Material.content_hash == content_hash)
            .limit(1)
        )
    ).scalar_one_or_none()
    already_existed = existing is not None

    storage = get_storage()
    try:
        if existing and existing.file_path:
            url = existing.file_url
            storage_path = existing.file_path
        else:
            storage_path = f"materials/{material_id}.{ext}"
            try:
                url = await storage.upload(
                    settings.storage_bucket, storage_path, spool, file.content_type
                )
            except Exception as exc:
                logger.warning("Storage upload failed for %s: %s", file.filename, exc)
                raise HTTPException(
                    status_code=502,
                    detail=f"Could not save file to storage ({type(exc).__name__}: {exc}). Please try again.",
                ) from exc

        material = Material(
            id=material_id,
            file_name=title or file.filename or f"material.{ext}",
            file_url=url,
            file_path=storage_path,
            file_size=file_size,
            topic_id=topic_id,
            uploader_id=user.id,
            processing_status=MaterialProcessingStatus.QUEUED,
            is_past_question=is_past_question == "true",
            exam_year=int(exam_year) if exam_year and exam_year.isdigit() else None,
            semester=semester if semester in ("FIRST", "SECOND") else None,
            content_hash=content_hash,
        )
        db.add(material)
        await db.flush()
    finally:
        spool.close()

    # Study points reward distinct past-question uploads only. A file the
    # vault has seen before (any uploader) earns nothing and is flagged so
    # the client can show "this PQ already exists".
    points_awarded = 0
    if material.is_past_question and not already_existed:
        points_awarded = await _award_pq_points(db, user.id, material)

    try:
        processed_twin = (
            await db.execute(
                select(Material)
                .where(
                    Material.content_hash == content_hash,
                    Material.processing_status == MaterialProcessingStatus.COMPLETED,
                )
                .limit(1)
            )
        ).scalar_one_or_none()

        # Do not wait on Celery's result backend here; uploads must stay fast even if Redis is down.
        if processed_twin:
            material.summary = processed_twin.summary
            material.questions = processed_twin.questions
            material.tips = processed_twin.tips
            material.processing_status = MaterialProcessingStatus.COMPLETED
            material.processed_at = processed_twin.processed_at
            logger.info(
                "Material %s reuses insights from %s (identical content hash)",
                material.id,
                processed_twin.id,
            )
        elif not _celery_broker_reachable():
            logger.warning(
                "Celery broker not reachable; skipping enqueue for material %s; it will stay QUEUED",
                material.id,
            )
        else:
            task = process_material_task.apply_async(
                kwargs={
                    "material_id": material.id,
                    "file_url": url,
                    "file_name": material.file_name,
                },
                ignore_result=True,
            )
            material.processing_job_id = task.id
    except Exception:
        logger.exception(
            "Could not finalize processing for material %s; it will stay QUEUED", material.id
        )
    await db.flush()

    await db.refresh(material, ["topic"])
    out = _material_to_out(material)
    out.already_existed = already_existed
    out.points_awarded = points_awarded
    return out


_UPLOAD_EXPIRES_SECONDS = 900
_DIRECT_UPLOAD_TYPES = {"application/pdf", "image/jpeg", "image/jpg", "image/png"}


@router.post("/request-upload", response_model=RequestUploadOut)
async def request_direct_upload(
    req: RequestUploadRequest,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reserve an object key and hand the client a presigned PUT URL.

    The client uploads the file directly to R2 (offloading VPS bandwidth),
    then calls ``complete_upload`` to register the material and start the
    ingestion pipeline. Falls back to the caller with a 501 when the active
    storage provider has no presigned-write support (e.g. Supabase).
    """
    if user.user.status.value == "ALUMNI":
        raise HTTPException(status_code=403, detail="Alumni cannot upload materials")
    if req.content_type not in _DIRECT_UPLOAD_TYPES:
        raise HTTPException(status_code=400, detail="Only PDF, JPEG, PNG allowed")
    max_bytes = settings.max_upload_mb * 1024 * 1024
    if req.file_size <= 0 or req.file_size > max_bytes:
        raise HTTPException(status_code=400, detail=f"File exceeds {settings.max_upload_mb}MB limit")

    storage = get_storage()
    material_id = str(uuid.uuid4())
    storage_path = f"materials/{material_id}.{_ext_from_content_type(req.content_type)}"
    try:
        upload_url = await storage.create_presigned_upload_url(
            settings.storage_bucket,
            storage_path,
            req.content_type,
            expires_in=_UPLOAD_EXPIRES_SECONDS,
        )
    except NotImplementedError:
        raise HTTPException(
            status_code=501,
            detail="Direct upload is not supported by the active storage provider",
        )

    return RequestUploadOut(
        material_id=material_id,
        storage_path=storage_path,
        upload_url=upload_url,
        expires_in=_UPLOAD_EXPIRES_SECONDS,
    )


def _ext_from_content_type(content_type: str) -> str:
    ext = content_type.split("/")[-1]
    return ext if ext != "jpeg" else "jpg"


@router.post("/complete-upload", response_model=MaterialOut)
async def complete_upload(
    req: CompleteUploadRequest,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Register a material whose bytes were uploaded directly to storage."""
    if user.user.status.value == "ALUMNI":
        raise HTTPException(status_code=403, detail="Alumni cannot upload materials")

    if not req.storage_path.startswith(f"materials/{req.material_id}."):
        raise HTTPException(status_code=400, detail="Upload path does not match the requested material")

    max_bytes = settings.max_upload_mb * 1024 * 1024
    if req.file_size <= 0 or req.file_size > max_bytes:
        raise HTTPException(status_code=400, detail=f"File exceeds {settings.max_upload_mb}MB limit")

    allowance = await storage_allowance(db, user.id)
    used = await storage_used(db, user.id)
    if used + req.file_size > allowance:
        raise HTTPException(
            status_code=400,
            detail=(
                "STORAGE_LIMIT_REACHED "
                f"(used {used // (1024 * 1024)}MB of {allowance // (1024 * 1024)}MB). "
                "Upgrade your plan to unlock more vault storage."
            ),
        )

    topic_id = await _resolve_topic(
        db, req.course_code, req.department_code, user.id, user.user.university_id
    )
    material_id = req.material_id
    content_hash = (req.content_hash or "").strip() or None

    # Content-address dedup mirrors the multipart path: an identical blob
    # already in the vault is reused and the fresh direct upload dropped.
    existing = (
        await db.execute(
            select(Material).where(Material.content_hash == content_hash).limit(1)
        )
    ).scalar_one_or_none() if content_hash else None
    already_existed = existing is not None

    storage = get_storage()
    # Clean up the object the client just uploaded when a duplicate exists.
    if already_existed and existing.file_path and existing.file_path != req.storage_path:
        try:
            await storage.delete(settings.storage_bucket, req.storage_path)
        except Exception:
            logger.warning(
                "Could not drop duplicate direct-upload blob %s", req.storage_path
            )

    storage_path = existing.file_path if already_existed and existing.file_path else req.storage_path
    url = await storage.get_public_url(settings.storage_bucket, storage_path)

    material = Material(
        id=material_id,
        file_name=req.file_name,
        file_url=url,
        file_path=storage_path,
        file_size=req.file_size,
        topic_id=topic_id,
        uploader_id=user.id,
        processing_status=MaterialProcessingStatus.QUEUED,
        is_past_question=req.is_past_question,
        exam_year=req.exam_year,
        semester=req.semester if req.semester in ("FIRST", "SECOND") else None,
        content_hash=content_hash,
    )
    db.add(material)
    await db.flush()

    points_awarded = 0
    if material.is_past_question and not already_existed:
        points_awarded = await _award_pq_points(db, user.id, material)

    try:
        processed_twin = (
            await db.execute(
                select(Material)
                .where(
                    Material.content_hash == content_hash,
                    Material.processing_status == MaterialProcessingStatus.COMPLETED,
                )
                .limit(1)
            )
        ).scalar_one_or_none() if content_hash else None

        if processed_twin:
            material.summary = processed_twin.summary
            material.questions = processed_twin.questions
            material.tips = processed_twin.tips
            material.processing_status = MaterialProcessingStatus.COMPLETED
            material.processed_at = processed_twin.processed_at
        elif not _celery_broker_reachable():
            logger.warning(
                "Celery broker not reachable; skipping enqueue for material %s; it will stay QUEUED",
                material.id,
            )
        else:
            # Sign a fresh URL: the stored one (or a twin's) may long have expired.
            worker_url = await storage.get_signed_url(settings.storage_bucket, storage_path)
            task = process_material_task.apply_async(
                kwargs={
                    "material_id": material.id,
                    "file_url": worker_url,
                    "file_name": material.file_name,
                },
                ignore_result=True,
            )
            material.processing_job_id = task.id
    except Exception:
        logger.exception(
            "Could not finalize processing for material %s; it will stay QUEUED", material.id
        )
    await db.flush()

    await db.refresh(material, ["topic"])
    out = _material_to_out(material)
    out.already_existed = already_existed
    out.points_awarded = points_awarded
    return out


@router.delete("/{material_id}")
async def delete_material(
    material_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    material = await db.get(Material, material_id)
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    if material.uploader_id != user.id:
        raise HTTPException(status_code=403, detail="Not your material")

    storage = get_storage()
    if material.file_path:
        # A deduplicated blob may be referenced by other materials; only delete
        # it when this is the last reference.
        other_refs = 0
        if material.content_hash:
            other_refs = await db.scalar(
                select(func.count())
                .select_from(Material)
                .where(
                    Material.content_hash == material.content_hash,
                    Material.id != material.id,
                )
            ) or 0
        if other_refs == 0:
            await storage.delete(settings.storage_bucket, material.file_path)

    await anyio.to_thread.run_sync(_vector_store.delete_document, material_id)

    await db.delete(material)
    await db.flush()
    return {"message": "Deleted"}


class ShareToggleRequest(BaseModel):
    is_shared: bool


@router.patch("/{material_id}/share", response_model=MaterialOut)
async def toggle_share(
    material_id: str,
    payload: ShareToggleRequest,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    material = await db.get(Material, material_id)
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    if material.uploader_id != user.id:
        raise HTTPException(status_code=403, detail="Not your material")

    material.is_shared = payload.is_shared
    await db.flush()
    await db.refresh(material, ["uploader"])
    return _material_to_out(material)


@router.get("/my-materials", response_model=MaterialListOut)
async def list_my_materials(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    total = (
        await db.execute(
            select(func.count())
            .select_from(Material)
            .where(Material.uploader_id == user.id)
        )
    ).scalar_one()

    result = await db.execute(
        select(Material)
        .options(selectinload(Material.uploader), selectinload(Material.topic))
        .where(Material.uploader_id == user.id)
        .order_by(Material.uploaded_at.desc())
        .offset(offset)
        .limit(limit)
    )
    items = [_material_to_out(m) for m in result.scalars().all()]
    return MaterialListOut(items=items, total=total)


@router.get("/course/{course_id}", response_model=list[MaterialOut])
async def list_course_materials(
    course_id: str,
    limit: int = Query(default=100, ge=1, le=300),
    offset: int = Query(default=0, ge=0),
    user: CurrentUser | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    course = await db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Department check only for authenticated users
    if user and not course.is_general and course.department_id != user.user.department_id:
        raise HTTPException(status_code=403, detail="Course not in your department")

    result = await db.execute(
        select(Material)
        .options(selectinload(Material.uploader), selectinload(Material.topic))
        .join(Topic, Topic.id == Material.topic_id)
        .where(Topic.course_id == course_id, Topic.is_active == True, Material.is_shared == True)  # noqa: E712
        .order_by(Material.uploaded_at.desc())
        .offset(offset)
        .limit(limit)
    )
    items = [_material_to_out(m) for m in result.scalars().all()]

    if user and len(items) < _POOL_FALLBACK_THRESHOLD:
        _, rows = await _fetch_pool(
            db, [course.code], user.user.university_id, limit=_POOL_FALLBACK_LIMIT
        )
        seen_ids = {o.id for o in items}
        seen_hashes = {o.content_hash for o in items if o.content_hash}
        items = items + _merge_pool_rows(rows, seen_ids, seen_hashes)

    return items


@router.get("/pool/{course_code}", response_model=MaterialListOut)
async def list_pool_materials(
    course_code: str,
    is_past_question: bool | None = Query(default=None),
    exam_year: int | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Browse materials for this course code shared from other institutions."""
    total, rows = await _fetch_pool(
        db,
        [course_code],
        user.user.university_id,
        is_past_question=is_past_question,
        exam_year=exam_year,
        offset=offset,
        limit=limit,
    )
    items = [_pool_row_to_out(row) for row in rows]
    return MaterialListOut(items=items, total=total)


@router.get("/recent", response_model=list[MaterialOut])
async def list_recent_materials(
    limit: int = Query(default=50, ge=1, le=100),
    user: CurrentUser | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Material)
        .options(selectinload(Material.uploader), selectinload(Material.topic))
        .join(Topic, Topic.id == Material.topic_id)
        .join(Course, Course.id == Topic.course_id)
        .where(
            Topic.is_active == True,
            Material.is_shared == True,
        )
    )
    
    # Filter by department if user is authenticated, otherwise show all shared materials
    if user:
        query = query.where(
            (Course.department_id == user.user.department_id) | (Course.is_general == True)
        )
    
    query = query.order_by(func.coalesce(Material.last_opened_at, Material.uploaded_at).desc()).limit(limit)
    result = await db.execute(query)
    items = [_material_to_out(m) for m in result.scalars().all()]

    if user and len(items) < _RECENT_FALLBACK_THRESHOLD:
        codes_stmt = (
            select(Course.code)
            .distinct()
            .where(
                (Course.department_id == user.user.department_id)
                | (
                    (Course.is_general == True)  # noqa: E712
                    & (Course.university_id == user.user.university_id)
                )
            )
            .limit(_RECENT_FALLBACK_CODES)
        )
        codes = [row[0] for row in (await db.execute(codes_stmt)).all()]
        if codes:
            _, rows = await _fetch_pool(
                db, codes, user.user.university_id, limit=_RECENT_FALLBACK_LIMIT
            )
            seen_ids = {o.id for o in items}
            seen_hashes = {o.content_hash for o in items if o.content_hash}
            items = items + _merge_pool_rows(rows, seen_ids, seen_hashes)

    return items


@router.post("/{material_id}/open")
async def mark_material_opened(
    material_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    material = await db.get(Material, material_id)
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    material.last_opened_at = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True}


@router.get("/past-questions", response_model=PastQuestionListOut)
async def search_past_questions(
    course_code: str = Query(default=""),
    year: int | None = Query(default=None),
    semester: str | None = Query(default=None),
    department_code: str = Query(default=""),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    filters = [Material.is_past_question == True, Material.is_shared == True]
    if course_code:
        filters.append(Course.code.ilike(f"%{course_code}%"))
    if year:
        filters.append(Material.exam_year == year)
    if semester:
        filters.append(Material.semester == semester)
    if department_code:
        filters.append(Department.code == department_code)

    count_query = (
        select(func.count())
        .select_from(Material)
        .join(Topic, Topic.id == Material.topic_id)
        .join(Course, Course.id == Topic.course_id)
        .where(*filters)
    )
    if department_code:
        count_query = count_query.join(Department, Department.id == Course.department_id)
    total = (await db.execute(count_query)).scalar_one()

    query = (
        select(Material, Course.code.label("course_code"), Course.title.label("course_title"))
        .options(selectinload(Material.uploader), selectinload(Material.topic))
        .join(Topic, Topic.id == Material.topic_id)
        .join(Course, Course.id == Topic.course_id)
        .where(*filters)
    )
    if department_code:
        query = query.join(Department, Department.id == Course.department_id)

    query = query.order_by(Material.uploaded_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    rows = result.all()

    items = [
        PastQuestionOut(
            id=m.id, file_name=m.file_name, file_url=m.file_url, file_size=m.file_size,
            topic_id=m.topic_id, uploader_id=m.uploader_id,
            uploader_name=m.uploader.full_name if m.uploader else None,
            uploader_avatar=m.uploader.avatar_url if m.uploader else None,
            processing_status=m.processing_status.value,
            summary=m.summary, questions=m.questions, tips=m.tips,
            uploaded_at=str(m.uploaded_at) if m.uploaded_at else None,
            is_seed=m.is_seed, is_shared=m.is_shared, is_past_question=m.is_past_question,
            exam_year=m.exam_year, semester=m.semester,
            course_code=cc, course_title=ct,
        )
        for m, cc, ct in rows
    ]
    return PastQuestionListOut(items=items, total=total)


class UnlockRequest(BaseModel):
    referrer_id: str | None = None
    share_url: str | None = None


REFERRAL_POINTS = 10


@router.get("/{material_id}", response_model=MaterialDetailOut)
async def get_material_detail(
    material_id: str,
    user: CurrentUser | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Material, Course.code.label("course_code"), Course.title.label("course_title"), Course.id.label("course_id"))
        .options(selectinload(Material.uploader), selectinload(Material.topic))
        .join(Topic, Topic.id == Material.topic_id)
        .join(Course, Course.id == Topic.course_id)
        .where(Material.id == material_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Material not found")

    m, course_code, course_title, course_id = row
    if not user and not m.is_shared:
        raise HTTPException(status_code=403, detail="Material is private")

    out = _material_to_out(m)
    return MaterialDetailOut(
        **out.model_dump(),
        course_id=course_id,
        course_code=course_code,
        course_title=course_title,
    )


@router.post("/{material_id}/unlock")
async def unlock_material(
    material_id: str,
    payload: UnlockRequest,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    material = await db.get(Material, material_id)
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    if not material.is_shared:
        raise HTTPException(status_code=403, detail="Material is private")

    if material.uploader_id == user.id:
        return {"unlocked": True, "already": False, "points_awarded": 0}

    existing = await db.execute(
        select(MaterialUnlock).where(
            MaterialUnlock.user_id == user.id,
            MaterialUnlock.material_id == material_id,
        )
    )
    if existing.scalar_one_or_none():
        return {"unlocked": True, "already": True, "points_awarded": 0}

    referrer_id = None
    points_awarded = 0
    if payload.referrer_id and payload.referrer_id != user.id:
        referrer = await db.get(User, payload.referrer_id)
        if referrer:
            already_rewarded = await db.execute(
                select(func.count())
                .select_from(MaterialUnlock)
                .where(
                    MaterialUnlock.user_id == user.id,
                    MaterialUnlock.referrer_id == payload.referrer_id,
                )
            )
            if already_rewarded.scalar_one() == 0:
                referrer.contribution_score += REFERRAL_POINTS
                db.add(PointsTransaction(
                    user_id=referrer.id,
                    amount=REFERRAL_POINTS,
                    reason="referral_unlock",
                    description="A new student unlocked a shared material via your link",
                    related_id=material_id,
                ))
                points_awarded = REFERRAL_POINTS
                referrer_id = payload.referrer_id

    db.add(MaterialUnlock(user_id=user.id, material_id=material_id, referrer_id=referrer_id))
    await db.flush()
    return {"unlocked": True, "already": False, "points_awarded": points_awarded}


@router.get("/{material_id}/file")
async def download_material(
    material_id: str,
    user: CurrentUser | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    material = await db.get(Material, material_id)
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    # Only allow access to shared materials for unauthenticated users
    if not user and not material.is_shared:
        raise HTTPException(status_code=403, detail="Material is private")

    storage = get_storage()
    url = await storage.get_signed_url(settings.storage_bucket, material.file_path)
    return {"download_url": url}
