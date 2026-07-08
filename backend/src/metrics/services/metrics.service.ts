import { Injectable } from '@nestjs/common';
import { Counter, Registry } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry: Registry;
  private readonly chatRequestCounter: Counter<'endpoint'>;
  private readonly eventsPublishedCounter: Counter<string>;

  constructor() {
    this.registry = new Registry();

    this.chatRequestCounter = new Counter({
      name: 'backend_chat_requests_total',
      help: 'Total requests to the chat API',
      labelNames: ['endpoint'] as const,
      registers: [this.registry],
    });

    this.eventsPublishedCounter = new Counter({
      name: 'backend_events_published_total',
      help: 'Total events published to RabbitMQ',
      registers: [this.registry],
    });
  }

  countChatRequest(endpoint: string): void {
    this.chatRequestCounter.inc({ endpoint });
  }

  countEventPublished(): void {
    this.eventsPublishedCounter.inc();
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  contentType(): string {
    return this.registry.contentType;
  }
}
