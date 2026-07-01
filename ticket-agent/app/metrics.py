from prometheus_client import Counter

events_consumed = Counter(
    "ticket_agent_events_consumed_total",
    "Total RabbitMQ events consumed by ticket-agent",
)

llm_requests = Counter(
    "ticket_agent_llm_requests_total",
    "Total LLM requests made by ticket-agent",
    ["node"],
)
