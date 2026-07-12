from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from tempfile import NamedTemporaryFile
from uuid import UUID, uuid4

import anyio
import psycopg
from fastapi import HTTPException, UploadFile, status

from app.core.config import get_settings
from app.core.postgres import get_connection


settings = get_settings()


@dataclass(slots=True)
class UploadedFileRecord:
    id: UUID
    filename: str
    content_hash: str
    storage_path: str
    file_size: int
    content_type: str | None
    created_at: datetime


class DuplicateFileError(Exception):
    def __init__(self, existing_file: UploadedFileRecord) -> None:
        super().__init__("File already exists.")
        self.existing_file = existing_file


async def _spool_upload_to_tempfile(upload_file: UploadFile) -> tuple[Path, str, int]:
    settings.temp_dir.mkdir(parents=True, exist_ok=True)

    sha256 = hashlib.sha256()
    total_bytes = 0

    with NamedTemporaryFile(delete=False, dir=settings.temp_dir, suffix=".upload") as temp_file:
        temp_path = Path(temp_file.name)
        while True:
            chunk = await upload_file.read(1024 * 1024)
            if not chunk:
                break

            total_bytes += len(chunk)
            if total_bytes > settings.max_upload_mb * 1024 * 1024:
                temp_path.unlink(missing_ok=True)
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail={"message": "Uploaded file exceeds the configured size limit."},
                )

            sha256.update(chunk)
            temp_file.write(chunk)

    await upload_file.close()
    return temp_path, sha256.hexdigest(), total_bytes


def _row_to_record(row: dict) -> UploadedFileRecord:
    return UploadedFileRecord(
        id=row["id"],
        filename=row["filename"],
        content_hash=row["content_hash"],
        storage_path=row["storage_path"],
        file_size=row["file_size"],
        content_type=row["content_type"],
        created_at=row["created_at"],
    )


def _fetch_existing_file(content_hash: str) -> UploadedFileRecord | None:
    query = """
        SELECT id, filename, content_hash, storage_path, file_size, content_type, created_at
        FROM uploaded_files
        WHERE content_hash = %s
    """

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (content_hash,))
            row = cursor.fetchone()

    if row is None:
        return None

    return _row_to_record(row)


def _insert_file_record(
    *,
    file_id: UUID,
    filename: str,
    content_hash: str,
    storage_path: str,
    file_size: int,
    content_type: str | None,
) -> UploadedFileRecord:
    query = """
        INSERT INTO uploaded_files (
            id,
            filename,
            content_hash,
            storage_path,
            file_size,
            content_type
        )
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id, filename, content_hash, storage_path, file_size, content_type, created_at
    """

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                query,
                (file_id, filename, content_hash, storage_path, file_size, content_type),
            )
            row = cursor.fetchone()
            connection.commit()

    if row is None:
        raise RuntimeError("File record insert did not return a row.")

    return _row_to_record(row)


def _delete_file_record(file_id: UUID) -> None:
    query = "DELETE FROM uploaded_files WHERE id = %s"

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (file_id,))
            connection.commit()


async def store_uploaded_file(upload_file: UploadFile) -> UploadedFileRecord:
    temp_path, content_hash, file_size = await _spool_upload_to_tempfile(upload_file)
    storage_root = settings.upload_dir
    storage_root.mkdir(parents=True, exist_ok=True)
    storage_path = storage_root / content_hash
    file_id = uuid4()

    try:
        inserted_record = await anyio.to_thread.run_sync(
            lambda: _insert_file_record(
                file_id=file_id,
                filename=upload_file.filename or "uploaded-file",
                content_hash=content_hash,
                storage_path=str(storage_path),
                file_size=file_size,
                content_type=upload_file.content_type,
            )
        )
    except psycopg.errors.UniqueViolation:
        temp_path.unlink(missing_ok=True)
        existing_file = await anyio.to_thread.run_sync(
            lambda: _fetch_existing_file(content_hash)
        )
        if existing_file is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "message": "File already exists.",
                    "existing_file_id": None,
                    "existing_file_path": None,
                },
            )

        raise DuplicateFileError(existing_file)
    except psycopg.Error as exc:
        temp_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"message": "Database error while storing uploaded file."},
        ) from exc

    try:
        storage_path.parent.mkdir(parents=True, exist_ok=True)
        temp_path.replace(storage_path)
    except OSError as exc:
        await anyio.to_thread.run_sync(lambda: _delete_file_record(inserted_record.id))
        temp_path.unlink(missing_ok=True)
        storage_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"message": "File could not be written to storage."},
        ) from exc

    return inserted_record