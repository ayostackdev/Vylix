from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import CurrentUser, get_current_user
from app.models import (
    UserPrivacy, UserProfile, User, UserBadge, Badge, BadgeRarity,
)

router = APIRouter(prefix="/settings", tags=["settings"])


class PrivacyOut(BaseModel):
    is_stealth_mode: bool = False
    show_contributions: bool = True
    show_email: bool = False
    show_department: bool = True

    model_config = {"from_attributes": True}


class PrivacyUpdate(BaseModel):
    is_stealth_mode: bool | None = None
    show_contributions: bool | None = None
    show_email: bool | None = None
    show_department: bool | None = None


class PublicProfileOut(BaseModel):
    id: str
    full_name: str
    avatar_url: str | None = None
    bio: str | None = None
    contribution_score: int = 0
    department_name: str | None = None
    college_name: str | None = None


class BadgeOut(BaseModel):
    id: str
    code: str
    name: str
    description: str
    icon: str
    rarity: str

    model_config = {"from_attributes": True}


class UserBadgeOut(BaseModel):
    badge: BadgeOut
    earned_at: str | None = None


class LeaderboardEntry(BaseModel):
    user_id: str
    full_name: str
    avatar_url: str | None = None
    contribution_score: int = 0


@router.get("/privacy/{user_id}", response_model=PrivacyOut)
async def get_privacy(
    user_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.id != user_id:
        raise HTTPException(status_code=403, detail="Not your settings")
    result = await db.execute(select(UserPrivacy).where(UserPrivacy.user_id == user_id))
    p = result.scalar_one_or_none()
    if not p:
        return PrivacyOut()
    return p


@router.put("/privacy/{user_id}", response_model=PrivacyOut)
async def update_privacy(
    user_id: str,
    payload: PrivacyUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.id != user_id:
        raise HTTPException(status_code=403, detail="Not your settings")
    result = await db.execute(select(UserPrivacy).where(UserPrivacy.user_id == user_id))
    p = result.scalar_one_or_none()
    if not p:
        p = UserPrivacy(user_id=user_id)
        db.add(p)
    if payload.is_stealth_mode is not None:
        p.is_stealth_mode = payload.is_stealth_mode
    if payload.show_contributions is not None:
        p.show_contributions = payload.show_contributions
    if payload.show_email is not None:
        p.show_email = payload.show_email
    if payload.show_department is not None:
        p.show_department = payload.show_department
    await db.flush()
    return p


@router.post("/stealth-mode/{user_id}")
async def toggle_stealth(
    user_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.id != user_id:
        raise HTTPException(status_code=403, detail="Not your settings")
    result = await db.execute(select(UserPrivacy).where(UserPrivacy.user_id == user_id))
    p = result.scalar_one_or_none()
    if not p:
        p = UserPrivacy(user_id=user_id, is_stealth_mode=True)
        db.add(p)
    else:
        p.is_stealth_mode = not p.is_stealth_mode
    await db.flush()
    return {"is_stealth_mode": p.is_stealth_mode}


@router.get("/public-profile/{user_id}", response_model=PublicProfileOut)
async def public_profile(
    user_id: str,
    db: AsyncSession = Depends(get_db),
):
    u = await db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    result = await db.execute(select(UserPrivacy).where(UserPrivacy.user_id == user_id))
    p = result.scalar_one_or_none()
    if p and p.is_stealth_mode:
        return PublicProfileOut(id=user_id, full_name="Anonymous")
    dept_name = None
    college_name = None
    if u.department_id:
        from app.models import Department
        dept = await db.get(Department, u.department_id)
        if dept:
            dept_name = dept.name
    if u.college_id:
        from app.models import College
        college = await db.get(College, u.college_id)
        if college:
            college_name = college.name
    return PublicProfileOut(
        id=u.id, full_name=u.full_name, avatar_url=u.avatar_url,
        bio=u.bio, contribution_score=u.contribution_score,
        department_name=dept_name, college_name=college_name,
    )


@router.get("/badges/{user_id}", response_model=list[UserBadgeOut])
async def get_user_badges(
    user_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.id != user_id:
        raise HTTPException(status_code=403, detail="Not your badges")
    result = await db.execute(
        select(UserBadge, Badge).join(Badge, Badge.id == UserBadge.badge_id)
        .where(UserBadge.user_id == user_id)
    )
    return [
        UserBadgeOut(
            badge=BadgeOut(id=b.id, code=b.code, name=b.name, description=b.description, icon=b.icon, rarity=b.rarity.value),
            earned_at=str(ub.earned_at) if ub.earned_at else None,
        )
        for ub, b in result.all()
    ]


@router.post("/badges/{user_id}")
async def award_badge(
    user_id: str,
    badge_code: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.id != user_id:
        raise HTTPException(status_code=403, detail="Not your badges")
    badge_result = await db.execute(select(Badge).where(Badge.code == badge_code))
    badge = badge_result.scalar_one_or_none()
    if not badge:
        raise HTTPException(status_code=404, detail="Badge not found")

    existing = await db.execute(
        select(UserBadge).where(UserBadge.user_id == user_id, UserBadge.badge_id == badge.id)
    )
    if existing.scalar_one_or_none():
        return {"message": "Already has badge"}

    ub = UserBadge(user_id=user_id, badge_id=badge.id)
    db.add(ub)

    score_map = {BadgeRarity.COMMON: 10, BadgeRarity.RARE: 25, BadgeRarity.EPIC: 50, BadgeRarity.LEGENDARY: 100}
    pts = score_map.get(badge.rarity, 10)
    user.user.contribution_score += pts
    await db.flush()
    return {"message": "Badge awarded", "points_earned": pts}


@router.delete("/badges/{user_id}/{badge_code}")
async def remove_badge(
    user_id: str,
    badge_code: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.id != user_id:
        raise HTTPException(status_code=403, detail="Not your badges")
    badge_result = await db.execute(select(Badge).where(Badge.code == badge_code))
    badge = badge_result.scalar_one_or_none()
    if not badge:
        raise HTTPException(status_code=404, detail="Badge not found")
    result = await db.execute(
        select(UserBadge).where(UserBadge.user_id == user_id, UserBadge.badge_id == badge.id)
    )
    ub = result.scalar_one_or_none()
    if ub:
        await db.delete(ub)
        await db.flush()
    return {"message": "Badge removed"}


@router.get("/badges/all", response_model=list[BadgeOut])
async def all_badges(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Badge))
    return [
        BadgeOut(id=b.id, code=b.code, name=b.name, description=b.description, icon=b.icon, rarity=b.rarity.value)
        for b in result.scalars().all()
    ]


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
async def leaderboard(
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User.id, User.full_name, User.avatar_url, User.contribution_score)
        .order_by(User.contribution_score.desc())
        .limit(50)
    )
    return [
        LeaderboardEntry(user_id=uid, full_name=fn, avatar_url=av, contribution_score=cs)
        for uid, fn, av, cs in result.all()
    ]
