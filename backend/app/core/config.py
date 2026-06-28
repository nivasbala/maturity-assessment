from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = ""
    jwt_secret_key: str = ""
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    admin_email: str = ""
    admin_password: str = ""
    admin_name: str = "System Admin"
    llm_provider: str = "ollama"
    ollama_base_url: str = "http://ollama:11434"
    ollama_model: str = "llama3.2"
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-6"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o"
    base_url: str = "http://localhost"
    cors_origins: list[str] = ["http://localhost", "http://localhost:3000"]

    model_config = SettingsConfigDict(env_file=".env")

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


settings = Settings()
