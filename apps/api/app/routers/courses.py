from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.deps import CurrentUser, get_current_user
from app.models import Course, Department, Topic, Material, User

router = APIRouter(prefix="/courses", tags=["courses"])


class CourseOut(BaseModel):
    id: str
    code: str
    title: str
    level: int
    is_general: bool
    past_question_count: int = 0
    department_name: str | None = None
    department_code: str | None = None
    department_color: str | None = None

    model_config = {"from_attributes": True}


@router.get("/my", response_model=list[CourseOut])
async def get_my_courses(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    u = user.user
    if not u.department_id or not u.current_level:
        return []

    level = int(u.current_level.replace("L", "")) if u.current_level else 1

    result = await db.execute(
        select(Course).where(
            (Course.department_id == u.department_id) | (Course.is_general == True),
            Course.level <= level,
        ).order_by(Course.code)
    )
    courses = result.scalars().all()

    out = []
    for c in courses:
        pq = await db.execute(
            select(Material)
            .join(Topic, Topic.id == Material.topic_id)
            .where(Topic.course_id == c.id, Material.is_past_question == True)
        )
        dept_name = None
        dept_code = None
        dept_color = None
        if c.department:
            dept_name = c.department.name
            dept_code = c.department.code
        out.append(CourseOut(
            id=c.id, code=c.code, title=c.title, level=c.level,
            is_general=c.is_general, past_question_count=len(pq.scalars().all()),
            department_name=dept_name, department_code=dept_code, department_color=dept_color,
        ))
    return out
