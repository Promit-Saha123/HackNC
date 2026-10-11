from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = ""
    gemini_api_key: str = ""
    elevenlabs_api_key: str = ""
    elevenlabs_voice_id: str = ""
    whoop_client_id: str = ""
    whoop_client_secret: str = ""
    cors_origins: str = "*"
    auth_secret: str = "dev-secret-change-me"  # set AUTH_SECRET in backend/.env for the demo


settings = Settings()