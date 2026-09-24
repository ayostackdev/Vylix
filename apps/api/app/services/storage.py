from __future__ import annotations

import abc
from pathlib import Path
from typing import BinaryIO, Union

from app.core.config import get_settings

settings = get_settings()

# Providers accept fully-buffered bytes or an open binary file-like object
# (e.g. a spooled temp file); httpx streams file-likes without buffering.
UploadData = Union[bytes, BinaryIO]


class StorageProvider(abc.ABC):
    @abc.abstractmethod
    async def upload(self, bucket: str, path: str, data: UploadData, content_type: str) -> str:
        """Upload file and return public URL."""

    @abc.abstractmethod
    async def delete(self, bucket: str, path: str) -> None:
        """Delete file from storage."""

    @abc.abstractmethod
    async def get_signed_url(self, bucket: str, path: str, expires_in: int = 3600) -> str:
        """Get a signed/download URL."""

    async def get_public_url(self, bucket: str, path: str, expires_in: int = 3600) -> str:
        """Get a stable public URL when the provider supports it, otherwise a
        short-lived signed URL."""
        return await self.get_signed_url(bucket, path, expires_in)

    async def create_presigned_upload_url(
        self, bucket: str, path: str, content_type: str, expires_in: int = 900
    ) -> str:
        """Return a URL the client can PUT the object to directly.

        Only implemented by providers with presigned-write support (R2).
        The abstract default raises, so callers can fall back to the
        server-side multipart upload path for other providers.
        """
        raise NotImplementedError(f"{type(self).__name__} does not support direct uploads")


class SupabaseStorage(StorageProvider):
    def __init__(self):
        import httpx
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise RuntimeError(
                "Supabase storage is not configured. Set SUPABASE_URL and "
                "SUPABASE_SERVICE_ROLE_KEY in the API environment."
            )
        self.base_url = f"{settings.supabase_url.rstrip('/')}/storage/v1"
        self.public_base = f"{settings.supabase_url.rstrip('/')}/storage/v1/object/public"
        self.key = settings.supabase_service_role_key
        self.headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
        }

    async def upload(self, bucket: str, path: str, data: UploadData, content_type: str) -> str:
        import httpx
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{self.base_url}/object/{bucket}/{path}",
                headers={
                    **self.headers,
                    "Authorization": f"Bearer {self.key}",
                    "Content-Type": content_type,
                    "x-upsert": "true",
                },
                content=data,
            )
            if resp.status_code >= 400:
                raise RuntimeError(
                    f"Supabase storage upload failed ({resp.status_code}): {resp.text[:500]}"
                )
        return f"{self.public_base}/{bucket}/{path}"

    async def delete(self, bucket: str, path: str) -> None:
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.delete(
                f"{self.base_url}/object/{bucket}/{path}",
                headers={**self.headers, "Authorization": f"Bearer {self.key}"},
            )
            resp.raise_for_status()

    async def get_signed_url(self, bucket: str, path: str, expires_in: int = 3600) -> str:
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/object/sign/{bucket}/{path}",
                headers={**self.headers, "Authorization": f"Bearer {self.key}"},
                json={"expiresIn": expires_in},
            )
            resp.raise_for_status()
            signed_url = resp.json().get("signedURL") or resp.json().get("signedUrl")
            if signed_url.startswith("/"):
                signed_url = f"{self.base_url}{signed_url}"
            return signed_url


class R2Storage(StorageProvider):
    def __init__(self):
        import boto3
        if not settings.r2_account_id or not settings.r2_access_key_id or not settings.r2_secret_access_key:
            raise RuntimeError(
                "R2 storage is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID "
                "and R2_SECRET_ACCESS_KEY in the API environment."
            )
        endpoint = f"https://{settings.r2_account_id}.r2.cloudflarestorage.com"
        self.client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=settings.r2_access_key_id,
            aws_secret_access_key=settings.r2_secret_access_key,
            region_name="auto",
        )

    def _public_url(self, bucket: str, path: str) -> str:
        base = self._public_base(bucket)
        if base:
            return f"{base.rstrip('/')}/{path}"
        return self.client.generate_presigned_url(
            "get_object", Params={"Bucket": bucket, "Key": path}, ExpiresIn=3600
        )

    def _public_base(self, bucket: str) -> str:
        """Resolve the public base URL for a bucket, falling back to the
        legacy single r2_public_base_url, then to no base (presigned only)."""
        if bucket == settings.r2_storage_bucket and settings.r2_storage_public_base_url:
            return settings.r2_storage_public_base_url
        if bucket == settings.r2_avatars_bucket and settings.r2_avatars_public_base_url:
            return settings.r2_avatars_public_base_url
        return settings.r2_public_base_url

    async def upload(self, bucket: str, path: str, data: UploadData, content_type: str) -> str:
        import anyio
        from functools import partial
        extra = {"ContentType": content_type} if content_type else {}
        if hasattr(data, "read"):
            await anyio.to_thread.run_sync(
                partial(self.client.upload_fileobj, data, bucket, path, extra)
            )
        else:
            await anyio.to_thread.run_sync(
                partial(self.client.put_object, Bucket=bucket, Key=path, Body=data, **extra)
            )
        return self._public_url(bucket, path)

    async def delete(self, bucket: str, path: str) -> None:
        import anyio
        from functools import partial
        try:
            await anyio.to_thread.run_sync(
                partial(self.client.delete_object, Bucket=bucket, Key=path)
            )
        except Exception as ex:
            if "404" in str(ex):
                return
            raise

    async def get_signed_url(self, bucket: str, path: str, expires_in: int = 3600) -> str:
        import anyio
        from functools import partial
        return await anyio.to_thread.run_sync(
            partial(
                self.client.generate_presigned_url,
                "get_object",
                Params={"Bucket": bucket, "Key": path},
                ExpiresIn=expires_in,
            )
        )

    async def get_public_url(self, bucket: str, path: str, expires_in: int = 3600) -> str:
        base = self._public_base(bucket)
        if base:
            return f"{base.rstrip('/')}/{path}"
        return await self.get_signed_url(bucket, path, expires_in)

    async def create_presigned_upload_url(
        self, bucket: str, path: str, content_type: str, expires_in: int = 900
    ) -> str:
        import anyio
        from functools import partial
        return await anyio.to_thread.run_sync(
            partial(
                self.client.generate_presigned_url,
                "put_object",
                Params={
                    "Bucket": bucket,
                    "Key": path,
                    "ContentType": content_type,
                },
                ExpiresIn=expires_in,
            )
        )


class AppwriteStorage(StorageProvider):
    def __init__(self):
        import httpx
        self.endpoint = settings.appwrite_endpoint
        self.project_id = settings.appwrite_project_id
        self.api_key = settings.appwrite_api_key
        self.bucket_id = settings.appwrite_storage_bucket_id
        self.headers = {
            "X-Appwrite-Project": self.project_id,
            "X-Appwrite-Key": self.api_key,
            "Content-Type": "multipart/form-data",
        }

    async def upload(self, bucket: str, path: str, data: UploadData, content_type: str) -> str:
        import httpx
        files = {"file": (Path(path).name, data, content_type)}
        data_fields = {"fileId": "unique()", "permissions[0]": 'read("any")'}
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.endpoint}/storage/buckets/{self.bucket_id}/files",
                headers={k: v for k, v in self.headers.items() if k != "Content-Type"},
                data=data_fields,
                files=files,
            )
            resp.raise_for_status()
            file_id = resp.json()["$id"]
        return f"{self.endpoint}/storage/buckets/{self.bucket_id}/files/{file_id}/view?project={self.project_id}"

    async def delete(self, bucket: str, path: str) -> None:
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.delete(
                f"{self.endpoint}/storage/buckets/{self.bucket_id}/files/{path}",
                headers={k: v for k, v in self.headers.items() if k != "Content-Type"},
            )
            if resp.status_code != 404:
                resp.raise_for_status()

    async def get_signed_url(self, bucket: str, path: str, expires_in: int = 3600) -> str:
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.endpoint}/storage/buckets/{self.bucket_id}/files/{path}/view",
                headers={k: v for k, v in self.headers.items() if k != "Content-Type"},
            )
            return str(resp.url)


def get_storage() -> StorageProvider:
    if settings.storage_provider == "appwrite":
        return AppwriteStorage()
    if settings.storage_provider == "r2":
        return R2Storage()
    return SupabaseStorage()
