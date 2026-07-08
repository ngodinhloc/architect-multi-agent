import { Module } from '@nestjs/common';
import { TicketProxyController } from './controllers/ticket-proxy.controller';
import { AuthModule } from '../auth/auth.module';
import { TicketClient } from './services/ticket.client';

@Module({
  providers: [TicketClient],
  imports: [AuthModule],
  controllers: [TicketProxyController],
})
export class TicketModule {}
