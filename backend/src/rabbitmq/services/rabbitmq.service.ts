import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as amqp from 'amqplib';
import type { ChatEventInterface } from '../contracts/chat-event.interface';
import { CHAT_EVENT_NAME } from '../contracts/chat-event.interface';
import { MetricsService } from '../../metrics/metrics.service';

const EXCHANGE = 'architect-events';
const QUEUE = 'architecture-agent.chat';
const ROUTING_KEY = CHAT_EVENT_NAME;

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private url = '';
  private reconnecting = false;
  private closing = false;

  constructor(private readonly metricsService: MetricsService) {}

  async onModuleInit() {
    this.url = process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672/';
    await this.connect();
  }

  private async connect(attempt = 1): Promise<void> {
    const maxAttempts = 10;
    try {
      const connection = await amqp.connect(this.url);
      const channel = await connection.createChannel();
      await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
      await channel.assertQueue(QUEUE, { durable: true });
      await channel.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);

      connection.on('error', (err) => this.handleDisconnect(err));
      connection.on('close', () => this.handleDisconnect(new Error('Connection closed')));

      this.connection = connection;
      this.channel = channel;
      this.reconnecting = false;
      this.logger.log('RabbitMQService.connect: Connected to RabbitMQ', { conversationId: null, exchange: EXCHANGE, queue: QUEUE });
    } catch (err) {
      if (attempt >= maxAttempts) throw err;
      const delay = Math.min(1000 * attempt, 10000);
      this.logger.warn(`RabbitMQService.connect: RabbitMQ not ready, retrying in ${delay}ms…`, { conversationId: null, attempt, maxAttempts });
      await new Promise((r) => setTimeout(r, delay));
      return this.connect(attempt + 1);
    }
  }

  private handleDisconnect(err: Error) {
    this.channel = null;
    this.connection = null;
    if (this.closing || this.reconnecting) return;
    this.reconnecting = true;
    this.logger.error(`RabbitMQService: connection lost, reconnecting: ${err.message}`, { conversationId: null });
    void this.connect().catch((reconnectErr) => {
      this.logger.error(`RabbitMQService: failed to reconnect: ${reconnectErr}`, { conversationId: null });
      this.reconnecting = false;
    });
  }

  async onModuleDestroy() {
    this.closing = true;
    await this.channel?.close();
    await this.connection?.close();
  }

  publish(event: ChatEventInterface): void {
    if (!this.channel) {
      this.logger.error('RabbitMQService.publish: RabbitMQ channel not ready', { conversationId: event.data.conversationId });
      return;
    }
    this.channel.publish(EXCHANGE, ROUTING_KEY, Buffer.from(JSON.stringify(event)), { persistent: true });
    this.metricsService.eventsPublished.inc();
    this.logger.log('RabbitMQService.publish: Published', { conversationId: event.data.conversationId, exchange: EXCHANGE });
  }
}
