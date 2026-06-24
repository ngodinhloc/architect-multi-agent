import asyncio
import logging
import aio_pika
from app.configs.event_configs import EXCHANGE_NAME, ACCEPT_EVENT_NAME, ACCEPT_QUEUE
from app.events.message_processor import MessageProcessor


class RabbitMQConsumer:
    def __init__(self, rabbitmq_url: str, message_processor: MessageProcessor, logger: logging.Logger):
        self._url = rabbitmq_url
        self._message_processor = message_processor
        self._logger = logger

    async def start(self) -> None:
        while True:
            try:
                await self._run()
            except asyncio.CancelledError:
                raise
            except Exception as e:
                self._logger.error("RabbitMQ consumer error: %s — retrying in 5s", e)
                await asyncio.sleep(5)

    async def _run(self) -> None:
        connection = await aio_pika.connect_robust(self._url)
        channel = await connection.channel()
        await channel.set_qos(prefetch_count=1)

        exchange = await channel.declare_exchange(EXCHANGE_NAME, aio_pika.ExchangeType.TOPIC, durable=True)
        queue = await channel.declare_queue(ACCEPT_QUEUE, durable=True)
        await queue.bind(exchange, routing_key=ACCEPT_EVENT_NAME)

        self._logger.info(
            "RabbitMQ consumer started | exchange=%s routing_key=%s queue=%s",
            EXCHANGE_NAME, ACCEPT_EVENT_NAME, ACCEPT_QUEUE,
        )

        async with queue.iterator() as messages:
            async for message in messages:
                async with message.process():
                    await self._message_processor.process(message)
