from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    ticket_service_url: str = "http://localhost:8003"
    cors_origins: str = "http://localhost:3000"
    redis_url: str = "redis://localhost:6379"
    provider_name: str = "Ticket MCP Server"
    provider_host: str = "http://localhost:8002"
    keycloak_url: str = "http://localhost:8080"
    keycloak_realm: str = "architect"
    keycloak_client_id: str = "mcp-server"
    keycloak_client_secret: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]


settings = Settings()
