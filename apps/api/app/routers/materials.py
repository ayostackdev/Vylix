from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Form, HTTPException, Query, UploadFile, File
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.database import get_db
from app.deps import CurrentUser, get_current_user, get_optional_user
from app.models import Material, Topic, Course, User, Department, MaterialProcessingStatus
from app.services.storage import get_storage
from app.tasks import process_material_task

settings = get_settings()
router = APIRouter(prefix="/materials", tags=["materials"])


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
    is_seed: bool = False
    is_shared: bool = True
    is_past_question: bool = False
    exam_year: int | None = None
    semester: str | None = None

    model_config = {"from_attributes": True}


class PastQuestionOut(MaterialOut):
    course_code: str | None = None
    course_title: str | None = None


class MaterialListOut(BaseModel):
    items: list[MaterialOut]
    total: int


class PastQuestionListOut(BaseModel):
    items: list[PastQuestionOut]
    total: int


def _material_to_out(m: Material) -> MaterialOut:
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
        is_seed=m.is_seed, is_shared=m.is_shared,
        is_past_question=m.is_past_question,
        exam_year=m.exam_year, semester=m.semester,
    )


async def _resolve_topic(
    db: AsyncSession,
    course_code: str | None,
    department_code: str | None,
    user_id: str,
) -> str:
    if not course_code:
        dept_topic = await db.execute(
            select(Topic).join(Course, Course.id == Topic.course_id)
            .where(Course.is_general == True, Topic.is_active == True)
            .order_by(Topic.last_activity.desc()).limit(1)
        )
        topic = dept_topic.scalar_one_or_none()
        if topic:
            return topic.id
        course = await db.execute(
            select(Course).where(Course.is_general == True).limit(1)
        )
        course = course.scalar_one_or_none()
        if not course:
            raise HTTPException(status_code=400, detail="No course found. Provide a course code.")
        topic = Topic(
            id=str(uuid.uuid4()), title="General Materials",
            course_id=course.id, author_id=user_id, is_active=True,
        )
        db.add(topic)
        await db.flush()
        return topic.id

    result = await db.execute(
        select(Course).where(Course.code.ilike(course_code)).limit(1)
    )
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(
            status_code=404,
            detail=f"Course '{course_code}' not found. Check the code or upload without one."
        )

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

    allowed = {"application/pdf", "image/jpeg", "image/png"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Only PDF, JPEG, PNG allowed")

    data = await file.read()
    max_bytes = settings.max_upload_mb * 1024 * 1024
    if len(data) > max_bytes:
        raise HTTPException(status_code=400, detail=f"File exceeds {settings.max_upload_mb}MB limit")

    topic_id = await _resolve_topic(db, course_code, department_code, user.id)

    material_id = str(uuid.uuid4())
    ext = file.filename.split(".")[-1] if file.filename else "pdf"
    storage_path = f"materials/{material_id}.{ext}"

    storage = get_storage()
    url = await storage.upload(settings.supabase_storage_bucket, storage_path, data, file.content_type)

    material = Material(
        id=material_id,
        file_name=title or file.filename or f"material.{ext}",
        file_url=url,
        file_path=storage_path,
        file_size=len(data),
        topic_id=topic_id,
        uploader_id=user.id,
        processing_status=MaterialProcessingStatus.QUEUED,
        is_past_question=is_past_question == "true",
        exam_year=int(exam_year) if exam_year and exam_year.isdigit() else None,
        semester=semester if semester in ("FIRST", "SECOND") else None,
    )
    db.add(material)
    await db.flush()

    task = process_material_task.delay(
        material_id=material.id,
        file_url=url,
        file_name=material.file_name,
    )
    material.processing_job_id = task.id
    await db.flush()

    await db.refresh(material, ["topic"])
    return _material_to_out(material)


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
        await storage.delete(settings.supabase_storage_bucket, material.file_path)

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
        .where(Topic.course_id == course_id, Topic.is_active == True, Material.is_shared == True)
        .order_by(Material.uploaded_at.desc())
    )
    return [_material_to_out(m) for m in result.scalars().all()]


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
    
    query = query.order_by(Material.uploaded_at.desc()).limit(limit)
    result = await db.execute(query)
    return [_material_to_out(m) for m in result.scalars().all()]


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
    url = await storage.get_signed_url(settings.supabase_storage_bucket, material.file_path)
    return {"download_url": url}
