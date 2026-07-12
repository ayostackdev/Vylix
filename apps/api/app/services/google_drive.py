from __future__ import annotations

import json
import time
from dataclasses import dataclass

import httpx

from app.core.config import get_settings

settings = get_settings()

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_DRIVE_API = "https://www.googleapis.com/drive/v3"
GOOGLE_DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3"

SCOPES = [
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
]


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


def get_auth_url(state: str) -> str:
    """Generate Google OAuth authorization URL."""
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
    """Exchange authorization code for tokens."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(GOOGLE_TOKEN_URL, data={
            "code": code,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri": settings.google_redirect_uri,
            "grant_type": "authorization_code",
        })
        resp.raise_for_status()
        data = resp.json()

    return GoogleTokens(
        access_token=data["access_token"],
        refresh_token=data.get("refresh_token"),
        expires_at=int(time.time()) + data.get("expires_in", 3600) if "expires_in" in data else None,
        scope=data.get("scope", ""),
    )


async def refresh_access_token(refresh_token: str) -> GoogleTokens:
    """Refresh an expired access token."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(GOOGLE_TOKEN_URL, data={
            "refresh_token": refresh_token,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "grant_type": "refresh_token",
        })
        resp.raise_for_status()
        data = resp.json()

    return GoogleTokens(
        access_token=data["access_token"],
        refresh_token=refresh_token,
        expires_at=int(time.time()) + data.get("expires_in", 3600),
        scope=data.get("scope", ""),
    )


async def get_user_info(access_token: str) -> dict:
    """Get user profile from Google."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        resp.raise_for_status()
        return resp.json()


async def list_drive_folders(access_token: str, parent_id: str = "root") -> list[DriveFolder]:
    """List folders in Google Drive."""
    query = f"'{parent_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
    async with httpx.AsyncClient() as client:
        resp = await client.get(
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
    """List PDF files in a Google Drive folder."""
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

    async with httpx.AsyncClient() as client:
        resp = await client.get(
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
    """Download a file from Google Drive."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{GOOGLE_DRIVE_API}/files/{file_id}",
            headers={"Authorization": f"Bearer {access_token}"},
            params={"alt": "media"},
            timeout=60.0,
        )
        resp.raise_for_status()
        return resp.content


async def get_file_metadata(access_token: str, file_id: str) -> DriveFile:
    """Get metadata for a single file."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
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
