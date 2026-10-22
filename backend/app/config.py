from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+psycopg://campus:campus@localhost:5432/campus"
    jwt_secret: str = Field(min_length=32)
    admin_password: str | None = None
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    model_base_url: str = ""
    model_name: str = ""
    model_api_key: str = ""
    model_disabled: bool = True
    model_timeout_seconds: int = 10
    file_storage_dir: str = "./storage"
    storage_backend: str = "local"


@lru_cache
def get_settings() -> Settings:
    return Settings()
