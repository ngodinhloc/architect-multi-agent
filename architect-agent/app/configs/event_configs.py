from app.events.contracts.event_handler_interface import EventHandlerInterface

EventHandlerMap = dict[str, EventHandlerInterface]

EXCHANGE_NAME = "architect-events"
CHAT_EVENT_NAME = "architecture-agent.chat"
CHAT_QUEUE = "architecture-agent.chat"
