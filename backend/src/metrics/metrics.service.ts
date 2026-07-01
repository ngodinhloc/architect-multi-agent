import { Injectable } from '@nestjs/common';
import { Counter, Registry } from 'prom-client';

@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  readonly chatRequests = new Counter({
    name: 'backend_chat_requests_total',
    help: 'Total requests to the chat API',
    labelNames: ['endpoint'] as const,
    registers: [this.registry],
  });

  readonly eventsPublished = new Counter({
    name: 'backend_events_published_total',
    help: 'Total events published to RabbitMQ',
    registers: [this.registry],
  });

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  contentType(): string {
    return this.registry.contentType;
  }
}
