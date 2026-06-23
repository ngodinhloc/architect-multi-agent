import logging
from functools import cached_property
from langchain_anthropic import ChatAnthropic
from langgraph.graph.state import CompiledStateGraph
from app.agent.architect_graph import ArchitectGraph
from app.configs.event_configs import EventHandlerMap, CHAT_EVENT_NAME
from app.configs.settings import settings
from app.events.handlers.chat_event_handler import ChatEventHandler
from app.events.message_processor import MessageProcessor
from app.events.rabbitmq_consumer import RabbitMQConsumer
from app.events.rabbitmq_publisher import RabbitMQPublisher
from app.services.chat_service import ChatService
from app.services.chat_manager import ChatManager
from app.services.redis_client import RedisClient


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
    def rabbitmq_publisher(self) -> RabbitMQPublisher:
        return RabbitMQPublisher(settings.rabbitmq_url, self.logger("rabbitmq_publisher"))

    @cached_property
    def agent_graph(self) -> CompiledStateGraph:
        return ArchitectGraph(self.llm, self.rabbitmq_publisher).build()

    @cached_property
    def redis_client(self) -> RedisClient:
        return RedisClient().get()

    @cached_property
    def chat_manager(self) -> ChatManager:
        return ChatManager(self.redis_client)

    @cached_property
    def chat_service(self) -> ChatService:
        return ChatService(
            agent_graph=self.agent_graph,
            chat_manager=self.chat_manager,
            logger=self.logger("chat_service"),
        )

    @cached_property
    def chat_event_handler(self) -> ChatEventHandler:
        return ChatEventHandler(
            chat_service=self.chat_service,
            logger=self.logger("chat_event_handler"),
        )

    @cached_property
    def event_handler_map(self) -> EventHandlerMap:
        return {
            CHAT_EVENT_NAME: self.chat_event_handler,
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
