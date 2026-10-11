from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = ""
    gemini_api_key: str = ""
    elevenlabs_api_key: str = ""
    elevenlabs_voice_id: str = ""
    whoop_client_id: str = ""
    whoop_client_secret: str = ""
    public_url: str = "https://sleep-squad-api.onrender.com"  # this API's public address: WHOOP redirects back to {public_url}/whoop/callback
    cors_origins: str = "*"
    auth_secret: str = "dev-secret-change-me"  # set AUTH_SECRET in backend/.env for the demo
    strict_privacy: bool = False  # True: overview/history are readable only by the signed-in user
    db_pool_max: int = 10  # connections per process. Keep (workers x this) under the Tiger plan's connection limit
    db_statement_timeout_ms: int = 15000


settings = Settings()