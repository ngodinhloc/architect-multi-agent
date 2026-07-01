import { Module } from '@nestjs/common';
import { TicketProxyController } from './controllers/ticket-proxy.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [TicketProxyController],
})
export class TicketModule {}
