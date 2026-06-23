import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RabbitMQService } from '../../rabbitmq/services/rabbitmq.service';
import { CHAT_EVENT_NAME, type ChatEventInterface } from '../../rabbitmq/contracts/chat-event.interface';
import { MessageInterface } from '../contracts/chat.interface';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(private readonly rabbitMQService: RabbitMQService) {}

  call(id: string, message: string, history: MessageInterface[] = []): void {
    try {
      const event: ChatEventInterface = {
        eventName: CHAT_EVENT_NAME,
        correlationId: randomUUID(),
        meta: { publisher: 'backend' },
        data: { conversationId: id, message, history },
      };
      this.rabbitMQService.publish(event);
    } catch (err) {
      this.logger.error(`Failed to publish to RabbitMQ for conversation ${id}: ${err}`);
    }
  }
}
