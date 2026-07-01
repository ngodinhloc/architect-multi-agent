import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { RedisService } from '../../redis/services/redis.service';
import { Conversation } from '../../database/entities/conversation.entity';
import {
  ChatInterface,
  ChatStatus,
  ChatActor,
  MessageInterface,
  AgentStatus,
} from '../contracts/chat.interface';
import { MessageService } from './message.service';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    private readonly redisService: RedisService,
    private readonly messageService: MessageService,
  ) {}

  private redisKey(id: string): string {
    return `chat:${id}`;
  }

  async newChat(message: string, username?: string): Promise<{ id: string }> {
    const id = uuidv4();
    const chatObject: ChatInterface = {
      id,
      title: message,
      messages: [{ actor: ChatActor.user, content: message, timestamp: new Date() }],
      status: ChatStatus.isActive,
      agentStatus: AgentStatus.isThinking,
    };
    const conversation = this.conversationRepo.create({
      uuid: id,
      title: message,
      username: username ?? null,
      messages: chatObject.messages as unknown as Record<string, unknown>[],
    });
    await this.conversationRepo.save(conversation);
    await this.redisService.setJson(this.redisKey(id), chatObject, 7200);
    this.messageService.publish(id, message, []);
    return { id };
  }

  async continueChat(id: string, message: string): Promise<{ accepted: true }> {
    let existingMessages: MessageInterface[];
    let title: string | null = null;

    const cached = await this.redisService.getJson<ChatInterface>(this.redisKey(id));
    if (cached) {
      existingMessages = cached.messages ?? [];
      title = cached.title ?? null;
    } else {
      const conversation = await this.conversationRepo.findOne({ where: { uuid: id } });
      if (!conversation) {
        throw new NotFoundException(`Conversation ${id} not found`);
      }
      existingMessages = conversation.messages as unknown as MessageInterface[];
      title = conversation.title ?? null;
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

  async stopChat(id: string): Promise<{ stopped: true }> {
    const current = await this.redisService.getJson<ChatInterface>(this.redisKey(id));
    if (!current) {
      throw new NotFoundException(`Conversation ${id} not found`);
    }

    await this.conversationRepo.save({
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
        this.conversationRepo.update(
          { uuid: id },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          { messages: cached.messages } as any,
        ).catch(() => {});
      }
      return cached;
    }

    const conversation = await this.conversationRepo.findOne({ where: { uuid: id } });
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

  async getHistory(username: string): Promise<{ id: string; title: string; createdAt: Date }[]> {
    const conversations = await this.conversationRepo.find({
      where: { username },
      order: { createdAt: 'DESC' },
      select: { uuid: true, title: true, createdAt: true },
    });
    return conversations.map((c) => ({ id: c.uuid, title: c.title ?? '', createdAt: c.createdAt }));
  }
}
