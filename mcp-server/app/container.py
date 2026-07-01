import logging
from functools import cached_property
from app.auth.jwt_middleware import JwtMiddleware
from app.auth.keycloak_token_service import KeycloakTokenService
from app.tools.epic_tool import EpicTool
from app.tools.ticket_tool import TicketTool


class Container:
    def logger(self, name: str) -> logging.Logger:
        return logging.getLogger(name)

    @cached_property
    def keycloak_token_service(self) -> KeycloakTokenService:
        return KeycloakTokenService()

    @cached_property
    def jwt_middleware(self) -> JwtMiddleware:
        return JwtMiddleware(logger=self.logger("jwt_middleware"))

    @cached_property
    def epic_tool(self) -> EpicTool:
        return EpicTool(keycloak_token_service=self.keycloak_token_service)

    @cached_property
    def ticket_tool(self) -> TicketTool:
        return TicketTool(keycloak_token_service=self.keycloak_token_service)


container = Container()
