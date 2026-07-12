from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import verify_maintenance_key
from app.models import Material, MaterialProcessingStatus

router = APIRouter(prefix="/maintenance", tags=["maintenance"])


@router.get("/materials/queue")
async def material_queue_stats(
    _: str = Depends(verify_maintenance_key),
    db: AsyncSession = Depends(get_db),
):
    counts = {}
    for status in MaterialProcessingStatus:
        result = await db.execute(
            select(func.count()).select_from(Material)
            .where(Material.processing_status == status)
        )
        counts[status.value.lower()] = result.scalar() or 0
    return {"queue": counts}


@router.post("/materials/queue/{job_id}/retry")
async def retry_job(
    job_id: str,
    _: str = Depends(verify_maintenance_key),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Material).where(Material.processing_job_id == job_id)
    )
    material = result.scalar_one_or_none()
    if not material:
        raise HTTPException(status_code=404, detail="Job not found")
    material.processing_status = MaterialProcessingStatus.QUEUED
    material.processing_error = None
    await db.flush()
    return {"message": "Retrying", "material_id": material.id}
