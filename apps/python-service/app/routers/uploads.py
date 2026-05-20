from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, File, UploadFile, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict

from app.services.upload_service import DuplicateFileError, UploadedFileRecord, store_uploaded_file


router = APIRouter(prefix="/uploads", tags=["uploads"])


class UploadResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    filename: str
    content_hash: str
    storage_path: str
    file_size: int
    content_type: str | None
    created_at: datetime


@router.post("", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(file: UploadFile = File(...)) -> UploadResponse | JSONResponse:
    try:
        uploaded_file: UploadedFileRecord = await store_uploaded_file(file)
    except DuplicateFileError as exc:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={
                "message": "File already exists.",
                "existing_file_id": str(exc.existing_file.id),
                "existing_file_path": exc.existing_file.storage_path,
            },
        )

    return UploadResponse(
        id=str(uploaded_file.id),
        filename=uploaded_file.filename,
        content_hash=uploaded_file.content_hash,
        storage_path=uploaded_file.storage_path,
        file_size=uploaded_file.file_size,
        content_type=uploaded_file.content_type,
        created_at=uploaded_file.created_at,
    )