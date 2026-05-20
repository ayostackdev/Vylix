from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "CamPulse AI Service"
    environment: str = "development"
    api_prefix: str = "/api/v1"
    cors_origins: str = Field(default="http://localhost:3000")
    postgres_dsn: str = Field(
        default="postgresql://postgres:postgres@localhost:5432/campulse"
    )
    celery_broker_url: str = Field(default="redis://localhost:6379/0")
    celery_result_backend: str = Field(default="redis://localhost:6379/1")
    max_upload_mb: int = Field(default=50, ge=1)
    temp_dir: Path = Field(default=Path("./tmp"))
    upload_dir: Path = Field(default=Path("./storage/uploads"))

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
