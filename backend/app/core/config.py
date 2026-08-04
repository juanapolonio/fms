from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "FMS Marketplace API"
    app_env: str = "development"
    database_url: str = "postgresql+psycopg2://fms:fms@127.0.0.1:5432/fms"
    direct_url: str | None = None
    argo_jwt_secret: str = "development-only-change-me"
    argo_jwt_algorithm: str = "HS256"
    argo_jwt_issuer: str | None = None
    argo_jwt_audience: str | None = None
    argo_dev_organization_id: str = "00000000-0000-0000-0000-000000000001"
    argo_dev_user_id: str = "00000000-0000-0000-0000-000000000002"
    argo_dev_role: str = "Administrator"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
