from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    anthropic_api_key: str
    mcp_server_url: str = "http://localhost:8002"
    redis_url: str = "redis://localhost:6379"
    rabbitmq_url: str = "amqp://guest:guest@localhost:5672/"
    cors_origins: str = "http://localhost:3000"
    keycloak_url: str = "http://localhost:8080"
    keycloak_realm: str = "architect"
    keycloak_client_id: str = "ticket-agent"
    keycloak_client_secret: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]


settings = Settings()
