import { Controller, Get, Param } from '@nestjs/common';
import { TicketClient } from '../services/ticket.client';


@Controller('api')
export class TicketProxyController {
  constructor(
    private readonly ticketClient: TicketClient
  ) {}

  @Get('epic/:id')
  async getEpic(@Param('id') id: string) {
    return this.ticketClient.get(`/api/epic/${id}`);
  }

  @Get('epic/:epicId/tickets')
  async getEpicTickets(@Param('epicId') epicId: string) {
    return this.ticketClient.get(`/api/epic/${epicId}/tickets`);
  }

  @Get('ticket/:id')
  async getTicket(@Param('id') id: string) {
    return this.ticketClient.get(`/api/ticket/${id}`);
  }
}
