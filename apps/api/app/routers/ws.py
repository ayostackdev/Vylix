from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.websocket import manager

router = APIRouter(tags=["websocket"])


@router.websocket("/pulse")
async def pulse_websocket(
    websocket: WebSocket,
    department_code: str | None = Query(default=None),
    department_id: str | None = Query(default=None),
    user_id: str | None = Query(default=None),
):
    rooms = []

    if department_code:
        rooms.append(f"department:{department_code}")
    elif department_id:
        rooms.append(f"department:{department_id}")

    if user_id:
        rooms.append(f"user:{user_id}")

    for room in rooms:
        await manager.connect(websocket, room, user_id)

    if not rooms:
        await manager.connect(websocket, "global", user_id)

    try:
        while True:
            data = await websocket.receive_json()
            event = data.get("event", "")

            if event == "pulse:join":
                room_type = data.get("roomType", "department")
                room_key = data.get("roomKey", "")
                room = f"{room_type}:{room_key}"
                await manager.connect(websocket, room, user_id)

            elif event == "pulse:join-room":
                room_type = data.get("roomType", "department")
                room_key = data.get("roomKey", "")
                room = f"{room_type}:{room_key}"
                await manager.connect(websocket, room, user_id)

            elif event == "pulse:leave-room":
                room_type = data.get("roomType", "department")
                room_key = data.get("roomKey", "")
                room = f"{room_type}:{room_key}"
                manager.disconnect(websocket, room, user_id)

    except WebSocketDisconnect:
        for room in rooms:
            manager.disconnect(websocket, room, user_id)
        manager.disconnect(websocket, "global", user_id)
