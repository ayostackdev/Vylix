import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.websocket import manager
from app.security import decode_access_token

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])

AUTH_FAILED_CODE = 4001


async def _verify_ws_token(token: str | None) -> str | None:
    """Verify JWT and return user_id, or None if invalid."""
    if not token:
        return None
    try:
        payload = await decode_access_token(token)
        return payload.get("sub")
    except Exception:
        return None


@router.websocket("/pulse")
async def pulse_websocket(
    websocket: WebSocket,
    department_code: str | None = Query(default=None),
    department_id: str | None = Query(default=None),
    token: str | None = Query(default=None),
):
    verified_user_id = await _verify_ws_token(token)
    if not verified_user_id:
        logger.warning("WebSocket auth failed: invalid or missing token")
        await websocket.close(code=AUTH_FAILED_CODE, reason="Authentication required")
        return

    rooms = []

    if department_code:
        rooms.append(f"department:{department_code}")
    elif department_id:
        rooms.append(f"department:{department_id}")

    rooms.append(f"user:{verified_user_id}")

    for room in rooms:
        await manager.connect(websocket, room, verified_user_id)

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
