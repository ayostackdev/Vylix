import logging

import jwt
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.websocket import manager
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(tags=["websocket"])


def _verify_ws_token(token: str | None) -> str | None:
    """Verify JWT and return user_id, or None if invalid."""
    if not token:
        return None
    if not settings.supabase_jwt_secret:
        return None
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload.get("sub")
    except jwt.InvalidTokenError:
        return None


@router.websocket("/pulse")
async def pulse_websocket(
    websocket: WebSocket,
    department_code: str | None = Query(default=None),
    department_id: str | None = Query(default=None),
    user_id: str | None = Query(default=None),
    token: str | None = Query(default=None),
):
    verified_user_id = _verify_ws_token(token) or user_id
    rooms = []

    if department_code:
        rooms.append(f"department:{department_code}")
    elif department_id:
        rooms.append(f"department:{department_id}")

    if verified_user_id:
        rooms.append(f"user:{verified_user_id}")

    for room in rooms:
        await manager.connect(websocket, room, verified_user_id)

    if not rooms:
        await manager.connect(websocket, "global", verified_user_id)

    try:
        while True:
            data = await websocket.receive_json()
            event = data.get("event", "")

            if event == "pulse:join":
                room_type = data.get("roomType", "department")
                room_key = data.get("roomKey", "")
                room = f"{room_type}:{room_key}"
                await manager.connect(websocket, room, verified_user_id)

            elif event == "pulse:join-room":
                room_type = data.get("roomType", "department")
                room_key = data.get("roomKey", "")
                room = f"{room_type}:{room_key}"
                await manager.connect(websocket, room, verified_user_id)

            elif event == "pulse:leave-room":
                room_type = data.get("roomType", "department")
                room_key = data.get("roomKey", "")
                room = f"{room_type}:{room_key}"
                manager.disconnect(websocket, room, verified_user_id)

    except WebSocketDisconnect:
        for room in rooms:
            manager.disconnect(websocket, room, verified_user_id)
        manager.disconnect(websocket, "global", verified_user_id)
