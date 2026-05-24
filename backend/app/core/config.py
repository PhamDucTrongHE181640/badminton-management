from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    database_url: str = "postgresql+psycopg://netup:netup@localhost:5432/netup"
    redis_url: str = "redis://localhost:6379/0"
    cors_origins: str = "http://localhost:3000"
    frontend_base_url: str = "http://localhost:3000"
    app_secret_key: str = "dev-only-change-me"
    user_access_token_minutes: int = 30
    user_refresh_token_days: int = 30
    admin_access_token_minutes: int = 30
    admin_refresh_token_days: int = 14
    auth_cookie_secure: bool = False
    admin_seed_enabled: bool = False
    admin_seed_email: str = "admin@netup.local"
    admin_seed_username: str = "admin"
    admin_seed_password: str = "admin12345"
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/v1/auth/google/callback"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
