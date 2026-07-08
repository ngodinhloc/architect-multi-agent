import { v4 as uuidv4 } from 'uuid';
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Conversation } from '../entities/conversation.entity';
import { InjectRepository } from '@nestjs/typeorm/dist/common/typeorm.decorators';
import { ChatInterface, MessageInterface } from 'src/chat/contracts/chat.interface';
import { ChatActor } from 'src/chat/contracts/chat.interface';

@Injectable()
export class ConversationRepository {
    constructor(    
        @InjectRepository(Conversation)
        readonly repository: Repository<Conversation>
    ) {}

    async new(username: string, message: string): Promise<Conversation> {
        const conversation = this.repository.create({
            uuid: uuidv4(),
            title: message,
            username: username ?? null,
            messages: [{ actor: ChatActor.user, content: message, timestamp: new Date() }]
        });

        return await this.repository.save(conversation);
    }

    async save(conversation: Conversation): Promise<Conversation> {
        return await this.repository.save(conversation);
    }

    async update(uuid: string, messages: MessageInterface[]): Promise<void> {
        await this.repository.update(
            { uuid },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { messages: messages as unknown as Record<string, unknown>[] } as any,
        );
    }

    async findOneByUuid(uuid: string): Promise<Conversation | null> {
        return await this.repository.findOne({ where: { uuid } });
    }   

    async findByUsername(username: string): Promise<Conversation[]> {
        return await this.repository.find({
            where: { username },
            order: { createdAt: 'DESC' },
            select: { uuid: true, title: true, createdAt: true },
        });
    }
}