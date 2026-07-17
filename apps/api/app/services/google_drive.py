from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass

import httpx

from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_DRIVE_API = "https://www.googleapis.com/drive/v3"

SCOPES = [
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
]

_MAX_RETRIES = 4
_BASE_DELAY = 1.0


# ── Retry wrapper ──────────────────────────────────────────────────


def _is_retryable(status_code: int) -> bool:
    return status_code == 429 or status_code >= 500


def _parse_retry_after(resp: httpx.Response) -> float | None:
    val = resp.headers.get("retry-after")
    if not val:
        return None
    try:
        return float(val)
    except ValueError:
        return None


async def _request_with_retry(
    method: str,
    url: str,
    **kwargs,
) -> httpx.Response:
    """Make an HTTP request with exponential backoff on retryable errors."""
    last_exc: Exception | None = None

    for attempt in range(_MAX_RETRIES):
        async with httpx.AsyncClient() as client:
            resp = await client.request(method, url, **kwargs)

        if not _is_retryable(resp.status_code):
            return resp

        if attempt == _MAX_RETRIES - 1:
            return resp

        retry_after = _parse_retry_after(resp)
        delay = retry_after or min(
            _BASE_DELAY * (2 ** attempt) + (time.monotonic() % 1),
            30.0,
        )
        logger.warning(
            "Google API %s %s returned %d (attempt %d/%d), retrying in %.1fs",
            method, url, resp.status_code, attempt + 1, _MAX_RETRIES, delay,
        )
        await asyncio.sleep(delay)

    return resp


# ── Data classes ───────────────────────────────────────────────────


@dataclass
class GoogleTokens:
    access_token: str
    refresh_token: str | None
    expires_at: int | None
    scope: str


@dataclass
class DriveFile:
    id: str
    name: str
    mime_type: str
    size: int
    created_time: str
    modified_time: str
    webViewLink: str | None = None


@dataclass
class DriveFolder:
    id: str
    name: str
    mimeType: str


# ── OAuth ──────────────────────────────────────────────────────────


def get_auth_url(state: str) -> str:
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return f"{GOOGLE_AUTH_URL}?{query}"


async def exchange_code(code: str) -> GoogleTokens:
    resp = await _request_with_retry(
        "POST", GOOGLE_TOKEN_URL, data={
            "code": code,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri": settings.google_redirect_uri,
            "grant_type": "authorization_code",
        },
    )
    resp.raise_for_status()
    data = resp.json()
    return GoogleTokens(
        access_token=data["access_token"],
        refresh_token=data.get("refresh_token"),
        expires_at=int(time.time()) + data.get("expires_in", 3600) if "expires_in" in data else None,
        scope=data.get("scope", ""),
    )


async def refresh_access_token(refresh_token: str) -> GoogleTokens:
    resp = await _request_with_retry(
        "POST", GOOGLE_TOKEN_URL, data={
            "refresh_token": refresh_token,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "grant_type": "refresh_token",
        },
    )
    resp.raise_for_status()
    data = resp.json()
    return GoogleTokens(
        access_token=data["access_token"],
        refresh_token=refresh_token,
        expires_at=int(time.time()) + data.get("expires_in", 3600),
        scope=data.get("scope", ""),
    )


async def get_user_info(access_token: str) -> dict:
    resp = await _request_with_retry(
        "GET",
        "https://www.googleapis.com/oauth2/v2/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    resp.raise_for_status()
    return resp.json()


# ── Drive API ──────────────────────────────────────────────────────


async def list_drive_folders(access_token: str, parent_id: str = "root") -> list[DriveFolder]:
    query = f"'{parent_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
    resp = await _request_with_retry(
        "GET",
        f"{GOOGLE_DRIVE_API}/files",
        headers={"Authorization": f"Bearer {access_token}"},
        params={
            "q": query,
            "fields": "files(id,name,mimeType)",
            "pageSize": "100",
            "orderBy": "name",
        },
    )
    resp.raise_for_status()
    data = resp.json()
    return [
        DriveFolder(id=f["id"], name=f["name"], mimeType=f["mimeType"])
        for f in data.get("files", [])
    ]


async def list_drive_files(
    access_token: str,
    folder_id: str | None = None,
    page_size: int = 50,
    page_token: str | None = None,
) -> tuple[list[DriveFile], str | None]:
    mime_filter = "mimeType='application/pdf'"
    if folder_id:
        query = f"'{folder_id}' in parents and {mime_filter} and trashed=false"
    else:
        query = f"{mime_filter} and trashed=false"

    params = {
        "q": query,
        "fields": "nextPageToken,files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink)",
        "pageSize": str(page_size),
        "orderBy": "name",
    }
    if page_token:
        params["pageToken"] = page_token

    resp = await _request_with_retry(
        "GET",
        f"{GOOGLE_DRIVE_API}/files",
        headers={"Authorization": f"Bearer {access_token}"},
        params=params,
    )
    resp.raise_for_status()
    data = resp.json()

    files = [
        DriveFile(
            id=f["id"],
            name=f["name"],
            mime_type=f["mimeType"],
            size=int(f.get("size", 0)),
            created_time=f.get("createdTime", ""),
            modified_time=f.get("modifiedTime", ""),
            webViewLink=f.get("webViewLink"),
        )
        for f in data.get("files", [])
    ]
    return files, data.get("nextPageToken")


async def download_drive_file(access_token: str, file_id: str) -> bytes:
    resp = await _request_with_retry(
        "GET",
        f"{GOOGLE_DRIVE_API}/files/{file_id}",
        headers={"Authorization": f"Bearer {access_token}"},
        params={"alt": "media"},
        timeout=60.0,
    )
    resp.raise_for_status()
    return resp.content


async def get_file_metadata(access_token: str, file_id: str) -> DriveFile:
    resp = await _request_with_retry(
        "GET",
        f"{GOOGLE_DRIVE_API}/files/{file_id}",
        headers={"Authorization": f"Bearer {access_token}"},
        params={"fields": "id,name,mimeType,size,createdTime,modifiedTime,webViewLink"},
    )
    resp.raise_for_status()
    f = resp.json()
    return DriveFile(
        id=f["id"],
        name=f["name"],
        mime_type=f["mimeType"],
        size=int(f.get("size", 0)),
        created_time=f.get("createdTime", ""),
        modified_time=f.get("modifiedTime", ""),
        webViewLink=f.get("webViewLink"),
    )
