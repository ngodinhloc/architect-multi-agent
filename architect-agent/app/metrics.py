from prometheus_client import Counter

events_consumed = Counter(
    "architect_agent_events_consumed_total",
    "Total RabbitMQ events consumed by architect-agent",
)

llm_requests = Counter(
    "architect_agent_llm_requests_total",
    "Total LLM requests made by architect-agent",
    ["node"],
)
