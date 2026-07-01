from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    ticket_service_url: str = "http://localhost:8003"
    cors_origins: str = "http://localhost:3000"
    redis_url: str = "redis://localhost:6379"
    provider_name: str = "Ticket MCP Server"
    provider_host: str = "http://localhost:8002"
    whitelisted_hosts: str = "http://localhost:8001"
    private_key_pem: str = ""
    service_host: str = "http://localhost:8002"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    @property
    def whitelisted_hosts_list(self) -> list[str]:
        return [h.strip() for h in self.whitelisted_hosts.split(",")]


settings = Settings()
