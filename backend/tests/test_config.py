import pytest
from pydantic import ValidationError, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class StrictSettings(BaseSettings):
    database_url: str = ""
    jwt_secret_key: str = ""
    admin_email: str = ""
    admin_password: str = ""
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

    @field_validator("admin_email")
    @classmethod
    def admin_email_must_be_set(cls, v: str) -> str:
        if not v:
            raise ValueError("ADMIN_EMAIL must be set")
        return v

    @field_validator("admin_password")
    @classmethod
    def admin_password_must_be_set(cls, v: str) -> str:
        if not v:
            raise ValueError("ADMIN_PASSWORD must be set")
        return v


def _base_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost/test")
    monkeypatch.setenv("JWT_SECRET_KEY", "test-secret-key-that-is-long-enough-32chars")
    monkeypatch.setenv("ADMIN_EMAIL", "admin@test.com")
    monkeypatch.setenv("ADMIN_PASSWORD", "test-admin-password")


def test_missing_database_url_raises(monkeypatch):
    _base_env(monkeypatch)
    monkeypatch.delenv("DATABASE_URL")
    with pytest.raises(ValidationError) as exc_info:
        StrictSettings()
    assert "database_url" in str(exc_info.value)


def test_missing_jwt_secret_raises(monkeypatch):
    _base_env(monkeypatch)
    monkeypatch.delenv("JWT_SECRET_KEY")
    with pytest.raises(ValidationError) as exc_info:
        StrictSettings()
    assert "jwt_secret_key" in str(exc_info.value)


def test_missing_admin_email_raises(monkeypatch):
    _base_env(monkeypatch)
    monkeypatch.delenv("ADMIN_EMAIL")
    with pytest.raises(ValidationError) as exc_info:
        StrictSettings()
    assert "admin_email" in str(exc_info.value)


def test_missing_admin_password_raises(monkeypatch):
    _base_env(monkeypatch)
    monkeypatch.delenv("ADMIN_PASSWORD")
    with pytest.raises(ValidationError) as exc_info:
        StrictSettings()
    assert "admin_password" in str(exc_info.value)


def test_all_required_set_does_not_raise(monkeypatch):
    _base_env(monkeypatch)
    settings = StrictSettings()
    assert settings.database_url.startswith("postgresql")
    assert settings.jwt_secret_key != ""
    assert settings.admin_email != ""
    assert settings.admin_password != ""


def test_defaults_are_sensible():
    from app.core.config import settings
    assert settings.jwt_algorithm == "HS256"
    assert settings.access_token_expire_minutes == 15
    assert settings.refresh_token_expire_days == 7
    assert settings.llm_provider == "ollama"
    assert "http://localhost" in settings.cors_origins
