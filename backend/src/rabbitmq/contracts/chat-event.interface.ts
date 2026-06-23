import { MessageInterface } from '../../chat/contracts/chat.interface';

export const CHAT_EVENT_NAME = 'architecture-agent.chat' as const;

export interface EventMetaInterface {
  publisher: 'backend';
}

export interface EventDataInterface {
  conversationId: string;
  message: string;
  history: MessageInterface[];
}

export interface ChatEventInterface {
  eventName: typeof CHAT_EVENT_NAME;
  correlationId: string;
  meta: EventMetaInterface;
  data: EventDataInterface;
}
