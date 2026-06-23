import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as amqp from 'amqplib';
import type { ChatEventInterface } from '../contracts/chat-event.interface';
import { CHAT_EVENT_NAME } from '../contracts/chat-event.interface';

const EXCHANGE = 'architect-events';
const QUEUE = 'architecture-agent.chat';
const ROUTING_KEY = CHAT_EVENT_NAME;

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;

  async onModuleInit() {
    const url = process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672/';
    await this.connect(url);
  }

  private async connect(url: string, attempt = 1): Promise<void> {
    const maxAttempts = 10;
    try {
      this.connection = await amqp.connect(url);
      this.channel = await this.connection.createChannel();
      await this.channel.assertExchange(EXCHANGE, 'topic', { durable: true });
      await this.channel.assertQueue(QUEUE, { durable: true });
      await this.channel.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);
      this.logger.log(`Connected to RabbitMQ, exchange: ${EXCHANGE}, queue: ${QUEUE}`);
    } catch (err) {
      if (attempt >= maxAttempts) throw err;
      const delay = Math.min(1000 * attempt, 10000);
      this.logger.warn(`RabbitMQ not ready (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms…`);
      await new Promise((r) => setTimeout(r, delay));
      return this.connect(url, attempt + 1);
    }
  }

  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
  }

  publish(event: ChatEventInterface): void {
    if (!this.channel) {
      this.logger.error('RabbitMQ channel not ready');
      return;
    }
    this.channel.publish(EXCHANGE, ROUTING_KEY, Buffer.from(JSON.stringify(event)), { persistent: true });
  }
}
