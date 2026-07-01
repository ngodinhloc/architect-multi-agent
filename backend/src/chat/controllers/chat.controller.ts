import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ChatService } from '../services/chat.service';
import { NewChatDto } from '../dto/new-chat.dto';
import { ContinueChatDto } from '../dto/continue-chat.dto';

@Controller('api/chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('new')
  newChat(@Req() req: Request, @Body() dto: NewChatDto): Promise<{ id: string }> {
    return this.chatService.newChat(dto.message, req.user?.username);
  }

  @Post(':id/cont')
  @HttpCode(202)
  continueChat(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ContinueChatDto,
  ): Promise<{ accepted: true }> {
    return this.chatService.continueChat(id, dto.message);
  }

  @Post(':id/stop')
  stopChat(@Param('id', ParseUUIDPipe) id: string): Promise<{ stopped: true }> {
    return this.chatService.stopChat(id);
  }

  @Get('history')
  getHistory(@Req() req: Request) {
    return this.chatService.getHistory(req.user!.username);
  }

  @Get(':id')
  getChat(@Param('id', ParseUUIDPipe) id: string) {
    return this.chatService.getChat(id);
  }
}
