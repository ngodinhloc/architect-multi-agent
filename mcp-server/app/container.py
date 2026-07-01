import logging
from functools import cached_property
from app.auth.jwt_middleware import JwtMiddleware
from app.auth.jwt_service import JwtService
from app.configs.settings import settings
from app.tools.epic_tool import EpicTool
from app.tools.ticket_tool import TicketTool


class Container:
    def logger(self, name: str) -> logging.Logger:
        return logging.getLogger(name)

    @cached_property
    def jwt_service(self) -> JwtService:
        return JwtService()

    @cached_property
    def jwt_middleware(self) -> JwtMiddleware:
        return JwtMiddleware(settings=settings, logger=self.logger("jwt_middleware"))

    @cached_property
    def epic_tool(self) -> EpicTool:
        return EpicTool(jwt_service=self.jwt_service)

    @cached_property
    def ticket_tool(self) -> TicketTool:
        return TicketTool(jwt_service=self.jwt_service)


container = Container()
