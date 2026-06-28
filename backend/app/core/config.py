from pydantic_settings import BaseSettings


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

    class Config:
        env_file = ".env"


settings = Settings()
