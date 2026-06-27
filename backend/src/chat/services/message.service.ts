import { Injectable, Logger } from '@nestjs/common';
import { RabbitMQService } from '../../rabbitmq/services/rabbitmq.service';
import { CHAT_EVENT_NAME, type ChatEventInterface } from '../../rabbitmq/contracts/chat-event.interface';
import { MessageInterface } from '../contracts/chat.interface';

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);

  constructor(private readonly rabbitMQService: RabbitMQService) {}

  publish(id: string, message: string, history: MessageInterface[] = []): void {
    try {
      const event: ChatEventInterface = {
        eventName: CHAT_EVENT_NAME,
        meta: { publisher: 'backend' },
        data: { conversationId: id, message, history },
      };
      this.rabbitMQService.publish(event);
    } catch (err) {
      this.logger.error(
        `MessageService.publish: Failed to publish to RabbitMQ: ${err}`,
        { conversationId: id, body: message, history },
      );
    }
  }
}
