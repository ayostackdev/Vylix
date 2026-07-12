from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.deps import CurrentUser, get_current_user
from app.models import (
    Conversation, ConversationMember, Message, MessageReadReceipt,
    Notification, User, ConversationType, ConversationRole,
)

router = APIRouter(prefix="/collaboration", tags=["collaboration"])


class ConversationCreate(BaseModel):
    type: str = "GROUP"
    title: str | None = None
    member_ids: list[str] = []
    department_id: str | None = None
    topic_id: str | None = None


class ConversationOut(BaseModel):
    id: str
    type: str
    title: str | None = None
    created_by_id: str
    created_at: str | None = None
    updated_at: str | None = None
    unread_count: int = 0
    last_message: str | None = None

    model_config = {"from_attributes": True}


class MessageCreate(BaseModel):
    content: str
    metadata: dict | None = None


class MessageOut(BaseModel):
    id: str
    conversation_id: str
    sender_id: str
    content: str
    metadata: dict | None = None
    edited_at: str | None = None
    deleted_at: str | None = None
    created_at: str | None = None

    model_config = {"from_attributes": True}


class NotificationOut(BaseModel):
    id: str
    kind: str
    title: str
    message: str | None = None
    payload: dict | None = None
    read_at: str | None = None
    created_at: str | None = None

    model_config = {"from_attributes": True}


class UserSearchResult(BaseModel):
    id: str
    full_name: str
    avatar_url: str | None = None
    matric_number: str | None = None


@router.post("/conversations", response_model=ConversationOut)
async def create_conversation(
    payload: ConversationCreate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conv_type = ConversationType.DIRECT if payload.type == "DIRECT" else ConversationType.GROUP
    conv = Conversation(
        id=str(uuid.uuid4()), type=conv_type, title=payload.title,
        department_id=payload.department_id, topic_id=payload.topic_id,
        created_by_id=user.id,
    )
    db.add(conv)
    await db.flush()

    owner = ConversationMember(
        id=str(uuid.uuid4()), conversation_id=conv.id,
        user_id=user.id, role=ConversationRole.OWNER,
    )
    db.add(owner)

    for mid in payload.member_ids:
        if mid != user.id:
            member = ConversationMember(
                id=str(uuid.uuid4()), conversation_id=conv.id,
                user_id=mid, role=ConversationRole.MEMBER,
            )
            db.add(member)
    await db.flush()
    return ConversationOut(
        id=conv.id, type=conv.type.value, title=conv.title,
        created_by_id=conv.created_by_id,
        created_at=str(conv.created_at) if conv.created_at else None,
        updated_at=str(conv.updated_at) if conv.updated_at else None,
    )


@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ConversationMember).where(ConversationMember.user_id == user.id)
    )
    memberships = result.scalars().all()
    conv_ids = [m.conversation_id for m in memberships]
    if not conv_ids:
        return []

    convs = await db.execute(
        select(Conversation).where(Conversation.id.in_(conv_ids)).order_by(Conversation.updated_at.desc())
    )
    out = []
    for c in convs.scalars().all():
        unread = await db.execute(
            select(func.count()).select_from(MessageReadReceipt)
            .join(Message, Message.id == MessageReadReceipt.message_id)
            .where(Message.conversation_id == c.id, MessageReadReceipt.user_id != user.id)
        )
        last_msg = await db.execute(
            select(Message.content).where(Message.conversation_id == c.id, Message.deleted_at == None)
            .order_by(Message.created_at.desc()).limit(1)
        )
        out.append(ConversationOut(
            id=c.id, type=c.type.value, title=c.title,
            created_by_id=c.created_by_id,
            created_at=str(c.created_at) if c.created_at else None,
            updated_at=str(c.updated_at) if c.updated_at else None,
            unread_count=unread.scalar() or 0,
            last_message=last_msg.scalar_one_or_none(),
        ))
    return out


@router.get("/conversations/{conv_id}/messages", response_model=list[MessageOut])
async def list_messages(
    conv_id: str,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=100),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify membership
    mem = await db.execute(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conv_id,
            ConversationMember.user_id == user.id,
        )
    )
    if not mem.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member")

    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conv_id, Message.deleted_at == None)
        .order_by(Message.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    return [
        MessageOut(
            id=m.id, conversation_id=m.conversation_id, sender_id=m.sender_id,
            content=m.content, metadata=m.metadata, edited_at=str(m.edited_at) if m.edited_at else None,
            deleted_at=str(m.deleted_at) if m.deleted_at else None,
            created_at=str(m.created_at) if m.created_at else None,
        )
        for m in result.scalars().all()
    ]


@router.post("/conversations/{conv_id}/messages", response_model=MessageOut)
async def send_message(
    conv_id: str,
    payload: MessageCreate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    mem = await db.execute(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conv_id,
            ConversationMember.user_id == user.id,
        )
    )
    if not mem.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member")

    msg = Message(
        id=str(uuid.uuid4()), conversation_id=conv_id,
        sender_id=user.id, content=payload.content, metadata=payload.metadata,
    )
    db.add(msg)

    # Create notifications for other members
    members = await db.execute(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conv_id,
            ConversationMember.user_id != user.id,
        )
    )
    for m in members.scalars().all():
        notif = Notification(
            id=str(uuid.uuid4()), user_id=m.user_id,
            kind="message", title="New message",
            message=payload.content[:100], source_message_id=msg.id,
        )
        db.add(notif)

    await db.flush()
    return MessageOut(
        id=msg.id, conversation_id=msg.conversation_id, sender_id=msg.sender_id,
        content=msg.content, metadata=msg.metadata,
        created_at=str(msg.created_at) if msg.created_at else None,
    )


@router.patch("/messages/{msg_id}")
async def edit_message(
    msg_id: str,
    content: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    msg = await db.get(Message, msg_id)
    if not msg or msg.sender_id != user.id:
        raise HTTPException(status_code=403, detail="Cannot edit")
    msg.content = content
    msg.edited_at = datetime.now(timezone.utc)
    await db.flush()
    return {"message": "Edited"}


@router.delete("/messages/{msg_id}")
async def delete_message(
    msg_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    msg = await db.get(Message, msg_id)
    if not msg or msg.sender_id != user.id:
        raise HTTPException(status_code=403, detail="Cannot delete")
    msg.deleted_at = datetime.now(timezone.utc)
    await db.flush()
    return {"message": "Deleted"}


@router.post("/conversations/{conv_id}/read")
async def mark_read(
    conv_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conv_id, Message.deleted_at == None)
        .order_by(Message.created_at.desc())
    )
    msgs = result.scalars().all()
    for msg in msgs[:50]:
        existing = await db.execute(
            select(MessageReadReceipt).where(
                MessageReadReceipt.message_id == msg.id,
                MessageReadReceipt.user_id == user.id,
            )
        )
        if not existing.scalar_one_or_none():
            receipt = MessageReadReceipt(id=str(uuid.uuid4()), message_id=msg.id, user_id=user.id)
            db.add(receipt)

    # Update member's last_read_at
    mem = await db.execute(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conv_id,
            ConversationMember.user_id == user.id,
        )
    )
    member = mem.scalar_one_or_none()
    if member:
        member.last_read_at = datetime.now(timezone.utc)

    await db.flush()
    return {"message": "Marked read"}


@router.get("/unread-summary")
async def unread_summary(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conv_members = await db.execute(
        select(ConversationMember).where(ConversationMember.user_id == user.id)
    )
    total_unread = 0
    for cm in conv_members.scalars().all():
        count = await db.execute(
            select(func.count()).select_from(Message)
            .join(MessageReadReceipt, MessageReadReceipt.message_id == Message.id, isouter=True)
            .where(
                Message.conversation_id == cm.conversation_id,
                Message.sender_id != user.id,
                Message.deleted_at == None,
                MessageReadReceipt.id == None,
            )
        )
        total_unread += count.scalar() or 0

    notif_count = await db.execute(
        select(func.count()).select_from(Notification)
        .where(Notification.user_id == user.id, Notification.read_at == None)
    )
    return {"unread_messages": total_unread, "unread_notifications": notif_count.scalar() or 0}


@router.get("/users/search", response_model=list[UserSearchResult])
async def search_users(
    q: str = Query(...),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(
            or_(
                User.full_name.ilike(f"%{q}%"),
                User.matric_number.ilike(f"%{q}%"),
            )
        ).limit(20)
    )
    return [
        UserSearchResult(id=u.id, full_name=u.full_name, avatar_url=u.avatar_url, matric_number=u.matric_number)
        for u in result.scalars().all()
    ]


@router.get("/users/classmates", response_model=list[UserSearchResult])
async def classmates(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    u = user.user
    if not u.department_id or not u.current_level:
        return []
    result = await db.execute(
        select(User).where(
            User.department_id == u.department_id,
            User.current_level == u.current_level,
            User.id != user.id,
        ).limit(50)
    )
    return [
        UserSearchResult(id=u.id, full_name=u.full_name, avatar_url=u.avatar_url, matric_number=u.matric_number)
        for u in result.scalars().all()
    ]


@router.get("/notifications", response_model=list[NotificationOut])
async def list_notifications(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(100)
    )
    return [
        NotificationOut(
            id=n.id, kind=n.kind, title=n.title, message=n.message,
            payload=n.payload, read_at=str(n.read_at) if n.read_at else None,
            created_at=str(n.created_at) if n.created_at else None,
        )
        for n in result.scalars().all()
    ]


@router.post("/notifications/{notif_id}/read")
async def mark_notification_read(
    notif_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    notif = await db.get(Notification, notif_id)
    if not notif or notif.user_id != user.id:
        raise HTTPException(status_code=404, detail="Not found")
    notif.read_at = datetime.now(timezone.utc)
    await db.flush()
    return {"message": "Marked read"}
