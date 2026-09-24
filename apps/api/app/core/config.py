from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    app_name: str = "Vylix API"
    environment: str = "development"
    port: int = Field(default=4000)
    api_prefix: str = "/api/v1"

    # Database
    database_url: str = Field(
        default="postgresql://postgres:postgres@localhost:5432/vylix"
    )
    direct_url: str = Field(
        default="postgresql://postgres:postgres@localhost:5432/vylix"
    )

    # Redis — rate-limiting & caching (separate from Celery to prevent eviction)
    redis_url: str = Field(default="redis://localhost:6379/0")

    # Celery — broker and result backend (isolated DBs, can't evict rate-limit keys)
    celery_broker_url: str = Field(default="redis://localhost:6379/2")
    celery_result_backend: str = Field(default="redis://localhost:6379/1")

    # CORS
    cors_origins: str = Field(default="http://localhost:3000,https://vylix.vercel.app")

    # Uploads
    max_upload_mb: int = Field(default=50, ge=1)
    upload_dir: Path = Field(default=Path("./storage/uploads"))
    temp_dir: Path = Field(default=Path("./tmp"))

    # Storage Provider: "supabase", "r2" or "appwrite"
    storage_provider: str = Field(default="supabase")

    # Supabase
    supabase_url: str = Field(default="")
    supabase_service_role_key: str = Field(default="")
    supabase_storage_bucket: str = Field(default="materials")
    supabase_avatars_bucket: str = Field(default="avatars")
    supabase_jwt_secret: str = Field(default="")

    # Cloudflare R2 (S3-compatible; zero egress). Buckets:
    #   r2_storage_bucket  — main "materials" vault
    #   r2_avatars_bucket  — profile avatars
    # r2_public_base_url is an optional public custom domain; when unset the
    # provider falls back to short-lived presigned GET URLs.
    r2_account_id: str = Field(default="")
    r2_access_key_id: str = Field(default="")
    r2_secret_access_key: str = Field(default="")
    r2_storage_bucket: str = Field(default="vylix-materials")
    r2_avatars_bucket: str = Field(default="vylix-avatars")
    # Optional public base URLs, one per bucket (e.g. r2.dev host or custom
    # domain). r2_public_base_url is retained as a legacy single-URL fallback.
    r2_storage_public_base_url: str = Field(default="")
    r2_avatars_public_base_url: str = Field(default="")
    r2_public_base_url: str = Field(default="")

    # Appwrite
    appwrite_endpoint: str = Field(default="")
    appwrite_project_id: str = Field(default="")
    appwrite_api_key: str = Field(default="")
    appwrite_storage_bucket_id: str = Field(default="")

    # Study points (referrals / PQ uploads / redemption)
    points_weekly_earn_cap: int = Field(default=300, ge=1)
    points_expiry_days: int = Field(default=90, ge=1)
    max_referees_per_referrer: int = Field(default=5, ge=1)

    # AI
    gemini_api_key: str | None = Field(default=None)
    # Gate the expensive Pro model; false forces every agent call onto Flash-Lite.
    pro_tier_enabled: bool = Field(default=True)

    # Sentry error tracking
    sentry_dsn: str | None = Field(default=None)
    sentry_traces_sample_rate: float = Field(default=0.1)
    # Optional webhook for critical alerts (Slack, Discord, etc.)
    alert_webhook_url: str | None = Field(default=None)

    # Vector search
    # "auto" uses pgvector when an embedding provider is available, otherwise ChromaDB.
    # Explicit "pgvector" or "chromadb" forces the backend.
    vector_store_backend: str = Field(default="auto")
    # Embedding provider: "bge-m3" (self-hosted dense+sparse, no per-call cost),
    # "gemini" (paid API, legacy), or "hashing" (dev fallback).
    embedding_provider: str = Field(default="bge-m3")
    embedding_model: str = Field(default="gemini-embedding-001")
    # Must match the `material_chunks.embedding` column dimension (migration 035
    # resized it to 1024 for BGE-M3). The Gemini fallback pins outputDimensionality
    # to this value so both providers stay insert/query-compatible with pgvector.
    embedding_dimensions: int = Field(default=1024)
    embedding_batch_size: int = Field(default=64)
    embedding_cache_ttl_seconds: int = Field(default=604800)

    # BGE-M3 (self-hosted)
    bge_m3_model: str = Field(default="BAAI/bge-m3")
    bge_m3_device: str = Field(default="cpu")
    # Candidate pool fetched from the dense pass before the hybrid rerank.
    embedding_candidate_count: int = Field(default=50)
    # Hybrid score = dense_weight * dense + (1 - dense_weight) * sparse.
    embedding_dense_weight: float = Field(default=0.5)
    # ColBERT (BGE-M3 multi-vector) late-interaction rerank over the top
    # candidates. 0 disables it; higher weights trust the token-level MaxSim
    # score over the hybrid dense+sparse score.
    embedding_colbert_weight: float = Field(default=0.6)
    embedding_rerank_candidates: int = Field(default=20)

    # Exact-match response cache for the academic agent (whole-class dedup).
    prompt_cache_ttl_seconds: int = Field(default=604800)

    # Semantic response cache for the academic agent (question-level dedup):
    # embeds the raw student prompt and returns a cached answer when the
    # nearest stored query (same course + tier) has cosine similarity >=
    # threshold, skipping retrieval and the LLM entirely. Disabled
    # automatically when the embedding dimension does not match the
    # semantic_cache.question_embedding column (VECTOR(1024)).
    semantic_cache_threshold: float = Field(default=0.95)
    semantic_cache_ttl_seconds: int = Field(default=2419200)

    # Maintenance
    maintenance_api_key: str = Field(default="")

    # Google Drive
    google_client_id: str = Field(default="")
    google_client_secret: str = Field(default="")
    google_redirect_uri: str = Field(default="http://localhost:4000/api/v1/google-drive/callback")
    frontend_url: str = Field(default="http://localhost:3000")

    # Monnify
    monnify_api_key: str = Field(default="")
    monnify_secret_key: str = Field(default="")
    monnify_contract_code: str = Field(default="")
    monnify_base_url: str = Field(default="https://sandbox.monnify.com")

    # Worker
    materials_worker_concurrency: int = Field(default=5)

    # Admin — comma-separated emails that get admin role on first login
    admin_emails: str = Field(default="")

    model_config = SettingsConfigDict(
        env_file=str(PROJECT_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def storage_bucket(self) -> str:
        """Active main materials bucket for the configured provider."""
        if self.storage_provider == "r2":
            return self.r2_storage_bucket
        return self.supabase_storage_bucket

    @property
    def avatars_bucket(self) -> str:
        """Active avatar bucket for the configured provider."""
        if self.storage_provider == "r2":
            return self.r2_avatars_bucket
        return self.supabase_avatars_bucket


@lru_cache
def get_settings() -> Settings:
    return Settings()
