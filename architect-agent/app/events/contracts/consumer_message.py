from typing import Protocol


class RabbitMqMessage(Protocol):
    body: bytes
