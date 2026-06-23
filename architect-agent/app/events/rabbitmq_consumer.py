import logging
import aio_pika
from app.configs.event_configs import EXCHANGE_NAME, CHAT_EVENT_NAME, CHAT_QUEUE
from app.events.message_processor import MessageProcessor


class RabbitMQConsumer:
    def __init__(self, rabbitmq_url: str, message_processor: MessageProcessor, logger: logging.Logger):
        self._url = rabbitmq_url
        self._message_processor = message_processor
        self._logger = logger

    async def start(self) -> None:
        connection = await aio_pika.connect_robust(self._url)
        channel = await connection.channel()
        await channel.set_qos(prefetch_count=1)

        exchange = await channel.declare_exchange(EXCHANGE_NAME, aio_pika.ExchangeType.TOPIC, durable=True)
        queue = await channel.declare_queue(CHAT_QUEUE, durable=True)
        await queue.bind(exchange, routing_key=CHAT_EVENT_NAME)

        self._logger.info(
            "RabbitMQ consumer started | exchange=%s routing_key=%s queue=%s",
            EXCHANGE_NAME, CHAT_EVENT_NAME, CHAT_QUEUE,
        )

        async with queue.iterator() as messages:
            async for message in messages:
                async with message.process():
                    await self._message_processor.process(message)
