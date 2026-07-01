import { Injectable } from '@nestjs/common';
import { Counter, Registry } from 'prom-client';

@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  readonly requests = new Counter({
    name: 'ticket_service_requests_total',
    help: 'Total requests to the ticket-service API',
    labelNames: ['endpoint'] as const,
    registers: [this.registry],
  });

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  contentType(): string {
    return this.registry.contentType;
  }
}
