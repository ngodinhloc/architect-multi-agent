import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatController } from './controllers/chat.controller';
import { ChatService } from './services/chat.service';
import { MessageService } from './services/message.service';
import { ChatGateway } from './gateways/chat.gateway';
import { Conversation } from '../database/entities/conversation.entity';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [TypeOrmModule.forFeature([Conversation]), MetricsModule],
  controllers: [ChatController],
  providers: [ChatService, MessageService, ChatGateway],
})
export class ChatModule {}
