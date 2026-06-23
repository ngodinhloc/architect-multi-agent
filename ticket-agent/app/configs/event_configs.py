from app.events.contracts.event_handler_interface import EventHandlerInterface

EventHandlerMap = dict[str, EventHandlerInterface]

EXCHANGE_NAME = "architect-events"
ACCEPT_EVENT_NAME = "architecture-agent.accept"
ACCEPT_QUEUE = "architecture-agent.accept"
