from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_NAME: str = "SecureVision AI Backend"
    ENV: str = "dev"

    DATABASE_URL: str
    
    GROQ_API_KEY: str | None = None
    GROQ_MODEL: str = "qwen/qwen3-32b"
    GROQ_TIMEOUT_SECONDS: float = 8.0
    GROQ_MAX_RETRIES: int = 0
    GROQ_MAX_COMPLETION_TOKENS: int = 180
    CHAT_ENABLE_GEMINI_FALLBACK: bool = False
    GOOGLE_API_KEY: str | None = None
    GOOGLE_MODEL: str = "gemini-1.5-flash"
    CHAT_CONTEXT_MESSAGES: int = 12
    CHAT_CONTEXT_MAX_CHARS: int = 500

    JWT_SECRET_KEY: str = "CHANGE_ME"
    JWT_ALG: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

settings = Settings()
