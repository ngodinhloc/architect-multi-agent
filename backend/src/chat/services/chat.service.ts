import { Injectable, NotFoundException } from '@nestjs/common';
import { RedisService } from '../../redis/services/redis.service';
import {
  ChatInterface,
  ChatStatus,
  ChatActor,
  MessageInterface,
  AgentStatus,
  ChatHistoryInterface,
  ChatCreatedResponse,
  ChatContinueResponse,
  ChatStopResponse,
} from '../contracts/chat.interface';
import { MessageService } from './message.service';
import { ConversationRepository } from 'src/database/repositories/conversation.repository';

@Injectable()
export class ChatService {
  constructor(
    private readonly conversationRepo: ConversationRepository,
    private readonly redisService: RedisService,
    private readonly messageService: MessageService,
  ) {}

  async newChat(message: string, username: string): Promise<ChatCreatedResponse> {
    const conversation = await this.conversationRepo.new(username, message);
    const chatObject: ChatInterface = {
      id: conversation.uuid,
      title: conversation.title,
      messages: conversation.messages as unknown as MessageInterface[],
      status: ChatStatus.isActive,
      agentStatus: AgentStatus.isThinking,
    };
    
    await this.redisService.setJson(this.redisKey(chatObject.id), chatObject, 7200);
    this.messageService.publish(chatObject.id, message, []);
    return { id: chatObject.id };
  }

  async continueChat(id: string, message: string): Promise<ChatContinueResponse> {
    let existingMessages: MessageInterface[];
    let title: string;

    const cached: ChatInterface | null = await this.redisService.getJson<ChatInterface>(this.redisKey(id));
    if (cached) {
      existingMessages = cached.messages;
      title = cached.title;
    } else {
      const conversation = await this.conversationRepo.findOneByUuid(id);
      if (!conversation) {
        throw new NotFoundException(`Conversation ${id} not found`);
      }
      existingMessages = conversation.messages as unknown as MessageInterface[];
      title = conversation.title;
    }

    const newMessage: MessageInterface = {
      actor: ChatActor.user,
      content: message,
      timestamp: new Date(),
    };

    const chatObject: ChatInterface = {
      id,
      title,
      messages: [...existingMessages, newMessage],
      status: ChatStatus.isActive,
      agentStatus: AgentStatus.isThinking,
    };

    await this.redisService.setJson(this.redisKey(id), chatObject, 7200);
    this.messageService.publish(id, message, existingMessages);
    return { accepted: true };
  }

  async stopChat(id: string): Promise<ChatStopResponse> {
    const current = await this.redisService.getJson<ChatInterface>(this.redisKey(id));
    if (!current) {
      throw new NotFoundException(`Conversation ${id} not found`);
    }

    await this.conversationRepo.repository.save({
      uuid: id,
      title: current.title ?? undefined,
      messages: current.messages as unknown as Record<string, unknown>[],
    });

    await this.redisService.del(this.redisKey(id));
    return { stopped: true };
  }

  async getChat(id: string): Promise<ChatInterface> {
    const cached = await this.redisService.getJson<ChatInterface>(this.redisKey(id));
    if (cached) {
      if (cached.agentStatus === AgentStatus.hasReplied) {
        await this.conversationRepo.update(id, cached.messages);
      }
      return cached;
    }

    const conversation = await this.conversationRepo.findOneByUuid(id);
    if (!conversation) {
      throw new NotFoundException(`Conversation ${id} not found`);
    }

    return {
      id: conversation.uuid,
      title: conversation.title,
      messages: conversation.messages as unknown as MessageInterface[],
      status: ChatStatus.isStopped,
      agentStatus: AgentStatus.hasReplied,
    };
  }

  async getHistory(username: string): Promise<ChatHistoryInterface[]> {
    const conversations = await this.conversationRepo.findByUsername(username);
    return conversations.map((c) => ({ id: c.uuid, title: c.title ?? '', createdAt: c.createdAt }));
  }

  private redisKey(id: string): string {
    return `chat:${id}`;
  }
}
