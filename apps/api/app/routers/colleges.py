from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import College, Department

router = APIRouter(prefix="/colleges", tags=["colleges"])


class DepartmentOut(BaseModel):
    id: str
    code: str
    name: str

    model_config = {"from_attributes": True}


class CollegeOut(BaseModel):
    id: str
    code: str
    name: str
    duration_years: int

    model_config = {"from_attributes": True}


class CollegeWithDepartments(CollegeOut):
    departments: list[DepartmentOut] = []


@router.get("", response_model=list[CollegeOut])
async def list_colleges(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(College).order_by(College.name))
    return result.scalars().all()


@router.get("/{college_id}/departments", response_model=list[DepartmentOut])
async def list_departments(college_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Department).where(Department.college_id == college_id).order_by(Department.name)
    )
    return result.scalars().all()
