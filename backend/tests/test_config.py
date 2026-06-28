import os
import pytest
from pydantic import ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator


class StrictSettings(BaseSettings):
    database_url: str = ""
    jwt_secret_key: str = ""
    model_config = SettingsConfigDict(env_file=None)

    @field_validator("database_url")
    @classmethod
    def database_url_must_be_set(cls, v: str) -> str:
        if not v:
            raise ValueError("DATABASE_URL must be set")
        return v

    @field_validator("jwt_secret_key")
    @classmethod
    def jwt_secret_key_must_be_set(cls, v: str) -> str:
        if not v:
            raise ValueError("JWT_SECRET_KEY must be set")
        return v


def test_missing_database_url_raises(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("JWT_SECRET_KEY", "test-secret-key-that-is-long-enough-32chars")
    with pytest.raises(ValidationError) as exc_info:
        StrictSettings()
    assert "database_url" in str(exc_info.value)


def test_missing_jwt_secret_raises(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost/test")
    monkeypatch.delenv("JWT_SECRET_KEY", raising=False)
    with pytest.raises(ValidationError) as exc_info:
        StrictSettings()
    assert "jwt_secret_key" in str(exc_info.value)


def test_both_set_does_not_raise(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost/test")
    monkeypatch.setenv("JWT_SECRET_KEY", "test-secret-key-that-is-long-enough-32chars")
    settings = StrictSettings()
    assert settings.database_url.startswith("postgresql")
    assert settings.jwt_secret_key != ""


def test_defaults_are_sensible():
    os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost/test")
    os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-that-is-long-enough-32chars")
    from app.core.config import settings
    assert settings.jwt_algorithm == "HS256"
    assert settings.access_token_expire_minutes == 15
    assert settings.refresh_token_expire_days == 7
    assert settings.llm_provider == "ollama"
    assert "http://localhost" in settings.cors_origins
