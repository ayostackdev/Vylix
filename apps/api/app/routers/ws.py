import asyncio
import base64
import hashlib
import hmac
import logging
import time

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy import select

from app.core.config import get_settings
from app.database import async_session
from app.db_rls import apply_rls_context, set_current_user_id
from app.models import ConversationMember
from app.services.product_analytics import capture_event
from app.websocket import manager
from app.security import decode_access_token

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])

AUTH_FAILED_CODE = 4001
HEARTBEAT_TIMEOUT_CODE = 4002
FORBIDDEN_CODE = 4003
ROOM_FULL_CODE = 4004

# Server pings clients so half-open TCP sockets (dropped connections that
# never sent a close frame) are detected and reaped instead of accumulating.
HEARTBEAT_INTERVAL_SECONDS = 25.0
HEARTBEAT_TIMEOUT_SECONDS = 60.0


async def _verify_ws_token(token: str | None) -> str | None:
    """Verify JWT and return user_id, or None if invalid."""
    if not token:
        return None
    try:
        payload = await decode_access_token(token)
        return payload.get("sub")
    except Exception:
        return None


async def _heartbeat_loop(websocket: WebSocket) -> None:
    """Ping the client periodically; close if it goes quiet."""
    last_seen = time.monotonic()
    websocket.state.last_seen = last_seen

    while True:
        await asyncio.sleep(HEARTBEAT_INTERVAL_SECONDS)
        now = time.monotonic()
        if now - getattr(websocket.state, "last_seen", now) > HEARTBEAT_TIMEOUT_SECONDS:
            logger.info("WebSocket heartbeat timeout, closing")
            try:
                await websocket.close(code=HEARTBEAT_TIMEOUT_CODE, reason="Heartbeat timeout")
            except Exception:
                pass
            return
        try:
            await websocket.send_json({"event": "pulse:ping", "ts": now})
        except Exception:
            return


async def _is_conversation_member(user_id: str, conversation_id: str) -> bool:
    """Confirm the user belongs to the study group before joining its room."""
    set_current_user_id(user_id)
    try:
        async with async_session() as db:
            await apply_rls_context(db)
            row = await db.scalar(
                select(ConversationMember.id).where(
                    ConversationMember.conversation_id == conversation_id,
                    ConversationMember.user_id == user_id,
                )
            )
            return row is not None
    except Exception:
        logger.warning(
            "Study room membership check failed (conversation=%s)",
            conversation_id,
            exc_info=True,
        )
        return False
    finally:
        set_current_user_id(None)


def _turn_credentials(user_id: str) -> tuple[str, str]:
    """Mint coturn REST credentials: HMAC-SHA1 over `<expiry>:<user_id>`.

    coturn runs with `--use-auth-secret` and validates the same digest, so the
    shared secret never leaves the server. Credentials expire after
    `webrtc_turn_ttl_seconds`.
    """
    settings = get_settings()
    expiry = int(time.time()) + settings.webrtc_turn_ttl_seconds
    username = f"{expiry}:{user_id}"
    digest = hmac.new(
        settings.webrtc_turn_secret.encode("utf-8"),
        username.encode("utf-8"),
        hashlib.sha1,
    ).digest()
    return username, base64.b64encode(digest).decode("ascii")


def _ice_servers(user_id: str) -> list[dict]:
    """ICE servers returned to the browser (STUN always, TURN when configured)."""
    settings = get_settings()
    servers: list[dict] = []

    stun_urls = [u.strip() for u in settings.webrtc_stun_urls.split(",") if u.strip()]
    if stun_urls:
        servers.append({"urls": stun_urls})

    turn_urls = [u.strip() for u in settings.webrtc_turn_urls.split(",") if u.strip()]
    if turn_urls:
        turn: dict = {"urls": turn_urls}
        if settings.webrtc_turn_secret:
            turn["username"], turn["credential"] = _turn_credentials(user_id)
        else:
            if settings.webrtc_turn_username:
                turn["username"] = settings.webrtc_turn_username
            if settings.webrtc_turn_credential:
                turn["credential"] = settings.webrtc_turn_credential
        servers.append(turn)

    return servers


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

    rooms = set()

    def _join(room: str):
        rooms.add(room)

    if department_code:
        _join(f"department:{department_code}")
    elif department_id:
        _join(f"department:{department_id}")

    user_room = f"user:{verified_user_id}"
    _join(user_room)

    for room in rooms:
        await manager.connect(websocket, room, verified_user_id)

    # Runs alongside receive(); sending from a second task is safe because
    # Starlette/uvicorn keep send and receive queues independent.
    heartbeat_task = asyncio.create_task(_heartbeat_loop(websocket))

    try:
        while True:
            data = await websocket.receive_json()
            websocket.state.last_seen = time.monotonic()
            event = data.get("event", "")

            if event == "pulse:ping":
                # Client-initiated liveness check.
                try:
                    await websocket.send_json({"event": "pulse:pong"})
                except Exception:
                    break

            elif event in ("pulse:join", "pulse:join-room"):
                room_type = data.get("roomType", "department")
                room_key = data.get("roomKey", "")
                room = f"{room_type}:{room_key}"
                await manager.connect(websocket, room, verified_user_id)
                _join(room)

            elif event == "pulse:leave-room":
                room_type = data.get("roomType", "department")
                room_key = data.get("roomKey", "")
                room = f"{room_type}:{room_key}"
                manager.disconnect(websocket, room, verified_user_id)
                rooms.discard(room)

    except WebSocketDisconnect:
        pass
    finally:
        heartbeat_task.cancel()
        try:
            await heartbeat_task
        except (asyncio.CancelledError, Exception):
            pass
        for room in rooms:
            manager.disconnect(websocket, room, verified_user_id)


@router.websocket("/study-room/{conversation_id}")
async def study_room_websocket(
    websocket: WebSocket,
    conversation_id: str,
    token: str | None = Query(default=None),
):
    """WebRTC signaling for a group's audio study room.

    The socket is authorized against ``conversation_members`` once at connect;
    every offer/answer/ICE frame is then relayed only to another member of the
    same room. Media itself is peer-to-peer and never touches the server.
    """
    settings = get_settings()
    verified_user_id = await _verify_ws_token(token)
    if not verified_user_id:
        logger.warning("Study room auth failed: invalid or missing token")
        await websocket.close(code=AUTH_FAILED_CODE, reason="Authentication required")
        return

    if not await _is_conversation_member(verified_user_id, conversation_id):
        await websocket.accept()
        await websocket.send_json(
            {
                "event": "rtc:error",
                "code": "FORBIDDEN",
                "message": "You are not a member of this study group.",
            }
        )
        await websocket.close(code=FORBIDDEN_CODE, reason="Not a room member")
        return

    room = f"studyroom:{conversation_id}"
    existing_users = manager.users_in_room(room)
    if (
        verified_user_id not in existing_users
        and len(existing_users) >= settings.webrtc_max_participants
    ):
        await websocket.accept()
        await websocket.send_json(
            {
                "event": "rtc:error",
                "code": "ROOM_FULL",
                "message": "This study room is full.",
            }
        )
        await websocket.close(code=ROOM_FULL_CODE, reason="Room full")
        return

    websocket.state.user_id = verified_user_id
    await manager.connect(websocket, room, verified_user_id)
    websocket.state.last_seen = time.monotonic()

    await websocket.send_json(
        {
            "event": "rtc:ready",
            "selfId": verified_user_id,
            "conversationId": conversation_id,
            "iceServers": _ice_servers(verified_user_id),
            "maxParticipants": settings.webrtc_max_participants,
            "maxVideoParticipants": settings.webrtc_max_video_participants,
            "participants": manager.users_in_room(room),
        }
    )
    capture_event(
        verified_user_id,
        "study_room_joined",
        {
            "conversation_id": conversation_id,
            "participants": len(manager.users_in_room(room)),
        },
    )
    await manager.send_to_room(
        room,
        "rtc:peer-joined",
        {
            "userId": verified_user_id,
            "participants": manager.users_in_room(room),
        },
    )

    heartbeat_task = asyncio.create_task(_heartbeat_loop(websocket))

    try:
        while True:
            data = await websocket.receive_json()
            websocket.state.last_seen = time.monotonic()
            event = data.get("event", "")

            if event == "pulse:ping":
                try:
                    await websocket.send_json({"event": "pulse:pong"})
                except Exception:
                    break
                continue

            if event not in ("rtc:offer", "rtc:answer", "rtc:ice"):
                continue

            target = data.get("target")
            if not isinstance(target, str) or target == verified_user_id:
                continue
            if not manager.user_in_room(room, target):
                continue

            payload: dict = {
                "from": verified_user_id,
                "conversationId": conversation_id,
            }
            if event == "rtc:ice":
                candidate = data.get("candidate")
                if candidate is None:
                    continue
                payload["candidate"] = candidate
            else:
                sdp = data.get("sdp")
                if sdp is None:
                    continue
                payload["sdp"] = sdp

            await manager.send_to_user_in_room(room, target, event, payload)

    except WebSocketDisconnect:
        pass
    finally:
        heartbeat_task.cancel()
        try:
            await heartbeat_task
        except (asyncio.CancelledError, Exception):
            pass
        manager.disconnect(websocket, room, verified_user_id)
        await manager.send_to_room(
            room,
            "rtc:peer-left",
            {
                "userId": verified_user_id,
                "participants": manager.users_in_room(room),
            },
        )
