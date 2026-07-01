import logging
from functools import cached_property
from langchain_anthropic import ChatAnthropic
from app.agent.ticket_graph import TicketGraph
from app.agent.tools.mcp_client import McpClient
from app.agent.tools.mcp_tool_builder import McpToolBuilder
from app.auth.keycloak_token_service import KeycloakTokenService
from app.configs.event_configs import EventHandlerMap, ACCEPT_EVENT_NAME
from app.configs.settings import settings
from app.events.handlers.accept_event_handler import AcceptEventHandler
from app.events.message_processor import MessageProcessor
from app.events.rabbitmq_consumer import RabbitMQConsumer
from app.services.chat_manager import ChatManager
from app.services.redis_client import RedisClient
from app.services.ticket_service import TicketService


class Container:
    def logger(self, name: str) -> logging.Logger:
        return logging.getLogger(name)

    @cached_property
    def llm(self) -> ChatAnthropic:
        return ChatAnthropic(
            model="claude-sonnet-4-6",
            api_key=settings.anthropic_api_key,
            max_tokens=4096,
        )

    @cached_property
    def redis_client(self):
        return RedisClient().get()

    @cached_property
    def keycloak_token_service(self) -> KeycloakTokenService:
        return KeycloakTokenService()

    @cached_property
    def mcp_tool_builder(self) -> McpToolBuilder:
        return McpToolBuilder(
            redis_client=self.redis_client,
            mcp_client_factory=lambda host: McpClient(host, self.keycloak_token_service),
        )

    @cached_property
    def ticket_graph(self) -> TicketGraph:
        return TicketGraph(self.llm, self.mcp_tool_builder)

    @cached_property
    def chat_manager(self) -> ChatManager:
        return ChatManager(self.redis_client)

    @cached_property
    def ticket_service(self) -> TicketService:
        return TicketService(
            ticket_graph=self.ticket_graph,
            chat_manager=self.chat_manager,
            logger=self.logger("ticket_service"),
        )

    @cached_property
    def accept_event_handler(self) -> AcceptEventHandler:
        return AcceptEventHandler(
            ticket_service=self.ticket_service,
            logger=self.logger("accept_event_handler"),
        )

    @cached_property
    def event_handler_map(self) -> EventHandlerMap:
        return {
            ACCEPT_EVENT_NAME: self.accept_event_handler,
        }

    @cached_property
    def message_processor(self) -> MessageProcessor:
        return MessageProcessor(
            handler_map=self.event_handler_map,
            logger=self.logger("message_processor"),
        )

    @cached_property
    def rabbitmq_consumer(self) -> RabbitMQConsumer:
        return RabbitMQConsumer(
            rabbitmq_url=settings.rabbitmq_url,
            message_processor=self.message_processor,
            logger=self.logger("rabbitmq_consumer"),
        )


container = Container()
